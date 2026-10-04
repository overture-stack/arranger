import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	ENV_MIGRATION_URL,
	migrationGuideUrlFor,
	RENAMED_ENVS,
	resolveRenamedEnvs,
	UNREAD_ENVS,
} from './renamedEnvs.js';

const RENAMED_ANCHOR = `${ENV_MIGRATION_URL}#environment-variable-renames`;
const UNREAD_ANCHOR = `${ENV_MIGRATION_URL}#environment-variables-no-longer-read`;

/** Each 3.0 name beside the 3.1 name it was renamed to, as the migration guide lists them. */
const EXPECTED_RENAMES: [previous: string, current: string][] = [
	['ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS', 'ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS'],
	['CONFIG_PATH', 'CONFIGS_PATH'],
	['DEBUG', 'ENABLE_DEBUG'],
	['ES_ARRANGER_SET_INDEX', 'ES_ARRANGER_SETS_INDEX'],
	['ES_ARRANGER_SET_TYPE', 'ES_ARRANGER_SETS_TYPE'],
	['PORT', 'SERVER_PORT'],
	['SEARCH_CLIENT_TYPE', 'SEARCH_ENGINE'],
];

const BOOLEAN_NAMES = ['ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS', 'DEBUG'];
const NUMBER_NAMES = ['PORT'];

/** A value 3.0 read as set rather than as its default, written as 3.1 reads it the same way. */
const valueFor = (previous: string): string =>
	BOOLEAN_NAMES.includes(previous) ? 'true' : NUMBER_NAMES.includes(previous) ? '250' : `value-of-${previous}`;

suite('resolveRenamedEnvs: a 3.0 name set alone', () => {
	test('covers every renamed variable the migration guide lists', () => {
		assert.deepEqual(
			RENAMED_ENVS.map(({ current, previous }) => [previous, current]),
			EXPECTED_RENAMES,
		);
	});

	EXPECTED_RENAMES.forEach(([previous, current]) => {
		test(`${previous} supplies ${current}'s value, with one warning naming ${current} and linking the guide`, () => {
			// Given a deployment still setting the 3.0 name only
			const { env, notices } = resolveRenamedEnvs({ [previous]: valueFor(previous) });

			// Then the 3.1 name reads that value, and one deprecation notice names the new name and the guide
			assert.equal(env[current], valueFor(previous));
			assert.equal(notices.length, 1);
			assert.match(notices[0]?.message ?? '', new RegExp(`^${previous} is deprecated: set ${current} instead`));
			assert.ok(notices[0]?.message.includes(RENAMED_ANCHOR), notices[0]?.message);
		});
	});

	test('a blank 3.0 name counts as unset, supplying nothing and warning about nothing', () => {
		const { env, notices } = resolveRenamedEnvs({ CONFIG_PATH: '  ' });

		assert.equal(env.CONFIGS_PATH, undefined);
		assert.deepEqual(notices, []);
	});

	test('never repeats the value in a warning', () => {
		const { notices } = resolveRenamedEnvs({ CONFIG_PATH: '/srv/catalogue-configs' });

		assert.ok(!notices[0]?.message.includes('/srv/catalogue-configs'), notices[0]?.message);
	});
});

suite('resolveRenamedEnvs: a 3.0 value means what 3.0 read it as', () => {
	// 3.0 read a flag as true only for the exact text `true`, in any case and untrimmed, and a number as
	// `Number(value) || default`, so each of these took the default there and takes it here.
	const READ_AS_THE_DEFAULT_IN_3_0: [name: string, value: string, current: string][] = [
		['ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS', '1', 'ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS'],
		['ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS', ' true', 'ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS'],
		['PORT', '0', 'SERVER_PORT'],
		['PORT', 'not-a-port', 'SERVER_PORT'],
	];

	READ_AS_THE_DEFAULT_IN_3_0.forEach(([name, value, current]) => {
		test(`${name}=${JSON.stringify(value)}, which 3.0 read as the default, leaves ${current} unset and warns to remove it rather than copy it`, () => {
			const { env, notices } = resolveRenamedEnvs({ [name]: value });

			// Copying the value across would change what the server does, since 3.1 reads it differently
			assert.equal(env[current], undefined);
			assert.equal(notices.length, 1);
			assert.match(
				notices[0]?.message ?? '',
				new RegExp(
					`^${name} has no effect, as in 3.0, which read its value as the default: remove ${name}, and set ${current} only to change the default`,
				),
			);
			assert.ok(!notices[0]?.message.includes('instead'), notices[0]?.message);
		});
	});

	test('a flag 3.0 read as true supplies true, in any case', () => {
		const { env } = resolveRenamedEnvs({ ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS: 'TRUE' });

		assert.equal(env.ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS, 'true');
	});

	test('a number 3.0 read supplies that number, as 3.0 parsed it', () => {
		const { env: padded } = resolveRenamedEnvs({ PORT: ' 8080 ' });
		const { env: hexadecimal } = resolveRenamedEnvs({ PORT: '0x1F90' });

		assert.equal(padded.SERVER_PORT, '8080');
		assert.equal(hexadecimal.SERVER_PORT, '8080');
	});
});

suite('resolveRenamedEnvs: both names set', () => {
	test('the 3.1 name wins, and the warning says the 3.0 name was ignored and which one the server reads', () => {
		// Given a deployment setting both names, to different values
		const { env, notices } = resolveRenamedEnvs({ PORT: '8080', SERVER_PORT: '9090' });

		// Then the 3.1 name keeps its own value, and one notice says the 3.0 name was ignored
		assert.equal(env.SERVER_PORT, '9090');
		assert.equal(notices.length, 1);
		assert.match(
			notices[0]?.message ?? '',
			/^PORT is ignored because SERVER_PORT is also set, to a different value, and the server reads SERVER_PORT/,
		);
		assert.ok(notices[0]?.message.includes(RENAMED_ANCHOR), notices[0]?.message);
	});

	test('says nothing when both hold the same value, as where SERVER_PORT is set from a PORT a platform injects', () => {
		const { env, notices } = resolveRenamedEnvs({ PORT: '8080', SERVER_PORT: '8080' });

		assert.equal(env.SERVER_PORT, '8080');
		assert.deepEqual(notices, []);
	});
});

suite('resolveRenamedEnvs: DEBUG, which other tools read for their own settings', () => {
	['express:*', '1', ' true', 'false'].forEach((value) => {
		test(`DEBUG=${JSON.stringify(value)}, which 3.0 did not read as true, is left to those tools: no alias and no warning`, () => {
			const { env, notices } = resolveRenamedEnvs({ DEBUG: value });

			assert.equal(env.ENABLE_DEBUG, undefined);
			assert.deepEqual(notices, []);
		});
	});

	test('DEBUG=TRUE, which 3.0 read as true, is the 3.0 flag: it supplies true and warns', () => {
		const { env, notices } = resolveRenamedEnvs({ DEBUG: 'TRUE' });

		assert.equal(env.ENABLE_DEBUG, 'true');
		assert.equal(notices.length, 1);
	});
});

suite('resolveRenamedEnvs: variables no longer read', () => {
	UNREAD_ENVS.forEach(({ name }) => {
		test(`${name}, when set, warns that it has no effect, linking the guide`, () => {
			const { notices } = resolveRenamedEnvs({ [name]: 'anything' });

			assert.equal(notices.length, 1);
			assert.match(notices[0]?.message ?? '', new RegExp(`^${name} is no longer read and has no effect`));
			assert.ok(notices[0]?.message.includes(UNREAD_ANCHOR), notices[0]?.message);
		});
	});

	test('covers the five 3.0 variables nothing reads in 3.1', () => {
		assert.deepEqual(
			UNREAD_ENVS.map(({ name }) => name),
			['ENABLE_NETWORK_AGGREGATION', 'ES_LOG', 'MAX_DOWNLOAD_ROWS', 'MAX_LIVE_VERSIONS', 'NETWORK_AGGREGATIONS'],
		);
	});

	test('MAX_DOWNLOAD_ROWS, which 3.0 never applied, supplies no row limit and points at DOWNLOAD_MAX_ROWS', () => {
		// Given a 3.0 environment copied from its schema, which listed MAX_DOWNLOAD_ROWS=100
		const { env, notices } = resolveRenamedEnvs({ MAX_DOWNLOAD_ROWS: '100' });

		// Then no limit is set, as 3.0 applied none, and the warning names the variable that sets one
		assert.equal(env.DOWNLOAD_MAX_ROWS, undefined);
		assert.match(
			notices[0]?.message ?? '',
			/^MAX_DOWNLOAD_ROWS is no longer read and has no effect: .*DOWNLOAD_MAX_ROWS/,
		);
	});
});

suite('resolveRenamedEnvs: a deployment on 3.1 names only', () => {
	test('passes the environment through unchanged, with no warning', () => {
		const environment = { CONFIGS_PATH: './configs', ENABLE_DEBUG: 'true', SERVER_PORT: '5050' };

		const { env, notices } = resolveRenamedEnvs(environment);

		assert.deepEqual(env, environment);
		assert.deepEqual(notices, []);
	});
});

suite('migrationGuideUrlFor', () => {
	const GUIDE_PATH = 'docs/reference/08-Migration/v3.1.md';

	test("pins a release's link to that release's tag, so later edits to the guide cannot move it", () => {
		assert.equal(
			migrationGuideUrlFor('3.1.0'),
			`https://github.com/overture-stack/arranger/blob/search-server-v3.1.0/${GUIDE_PATH}`,
		);
	});

	test('points a development build, which has no tag, at the main branch', () => {
		const onMain = `https://github.com/overture-stack/arranger/blob/main/${GUIDE_PATH}`;

		assert.equal(migrationGuideUrlFor('0.0.0-dev'), onMain);
		assert.equal(migrationGuideUrlFor(''), onMain);
	});
});
