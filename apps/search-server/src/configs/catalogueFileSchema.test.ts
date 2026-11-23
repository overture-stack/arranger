import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { configFeatureFlagProperties } from '@overture-stack/arranger-types/configs/constants';

import { CATALOGUE_FILE_REFUSAL, parseCatalogueFiles } from './catalogueFileSchema.js';

const flagNames = Object.values(configFeatureFlagProperties);

const parseOne = (configs: Record<string, unknown>, sourceFileOf?: (key: string) => string | undefined) =>
	parseCatalogueFiles({ catalogueFolder: 'alpha', configs, sourceFileOf });

const refusalOf = (configs: Record<string, unknown>, sourceFileOf?: (key: string) => string | undefined) => {
	try {
		parseOne(configs, sourceFileOf);
	} catch (error) {
		return error as Error;
	}
	assert.fail('expected the configuration to be refused');
};

suite('parseCatalogueFiles', () => {
	suite('boolean feature flags', () => {
		flagNames.forEach((flag) => {
			test(`accepts ${flag} as true and as false`, () => {
				assert.deepEqual(parseOne({ [flag]: true }), { [flag]: true });
				assert.deepEqual(parseOne({ [flag]: false }), { [flag]: false });
			});

			['true', 'false', 1, 0, null].forEach((wrongValue) => {
				test(`refuses ${flag} set to ${JSON.stringify(wrongValue)}`, () => {
					const error = refusalOf({ [flag]: wrongValue });

					assert.equal(error.name, CATALOGUE_FILE_REFUSAL);
					assert.ok(error.message.includes(`"alpha"`));
					assert.ok(error.message.includes(flag));
					assert.ok(error.message.includes('must be true or false'));
				});
			});
		});

		test('names the file a flag came from when exactly one file sets it', () => {
			const error = refusalOf({ enableSets: 'true' }, (key) => (key === 'enableSets' ? 'base.json' : undefined));

			assert.equal(error.message, 'Catalogue "alpha": base.json sets enableSets, which must be true or false.');
		});

		test('names its configuration files in general when no single file is known to set the flag', () => {
			const error = refusalOf({ enableSets: 'true' });

			assert.equal(
				error.message,
				'Catalogue "alpha": its configuration files set enableSets, which must be true or false.',
			);
		});
	});

	suite('scalar keys', () => {
		test('accepts each scalar key as a string or number of its expected type', () => {
			const configs = {
				catalogId: 'alpha',
				description: 'Alpha catalogue',
				documentType: 'file',
				esHost: 'http://localhost:9200',
				esIndex: 'alpha-index',
				esPass: 'secret',
				esUser: 'user',
				maxAliases: 10,
				maxDepth: 5,
				nestingPrefix: 'nested',
				searchEngine: 'opensearch',
			};

			assert.deepEqual(parseOne(configs), configs);
		});

		test('refuses esIndex given as a number, naming the key and the rule', () => {
			const error = refusalOf({ esIndex: 4242424 });

			assert.equal(error.name, CATALOGUE_FILE_REFUSAL);
			assert.equal(
				error.message,
				'Catalogue "alpha": its configuration files set esIndex, which must be a string.',
			);
		});

		test('refuses catalogId given as null', () => {
			assert.equal(refusalOf({ catalogId: null }).name, CATALOGUE_FILE_REFUSAL);
		});

		test('refuses maxDepth given as a string', () => {
			const error = refusalOf({ maxDepth: '10' });

			assert.ok(error.message.includes('maxDepth'));
			assert.ok(error.message.includes('must be a number'));
		});
	});

	suite('keys left unvalidated', () => {
		test('loads unknown top-level keys with any value', () => {
			const configs = { someFutureKey: { nested: [1, 'two'] }, anotherKey: null };

			assert.deepEqual(parseOne(configs), configs);
		});

		['extended', 'facets', 'table', 'charts', 'matchbox', 'network', 'auth'].forEach((section) => {
			test(`loads the ${section} section with any shape`, () => {
				const configs = { [section]: 'not an object at all' };

				assert.deepEqual(parseOne(configs), configs);
			});
		});
	});

	suite('refusal message', () => {
		test('never contains the offending value', () => {
			const flagError = refusalOf({ enableSets: 'canary-7f3a' });
			const scalarError = refusalOf({ esIndex: 4242424 });

			assert.ok(!flagError.message.includes('canary-7f3a'));
			assert.ok(!scalarError.message.includes('4242424'));
		});
	});
});

suite('logging a catalogue-file refusal', () => {
	test('logs under configs.startup_refused, naming the catalogue, file and key but never the value', () => {
		const consoleError = mock.method(console, 'error', () => undefined);

		refusalOf({ enableSets: 'canary-7f3a' }, (key) => (key === 'enableSets' ? 'base.json' : undefined));
		consoleError.mock.restore();

		const [event, reason, details] = consoleError.mock.calls[0]?.arguments ?? [];
		assert.equal(consoleError.mock.callCount(), 1);
		assert.equal(event, 'configs.startup_refused');
		assert.equal(reason, 'Catalogue "alpha": base.json sets enableSets, which must be true or false.');
		assert.deepEqual(details, { catalogue: 'alpha', file: 'base.json', key: 'enableSets' });
		assert.ok(!JSON.stringify(consoleError.mock.calls[0]?.arguments).includes('canary-7f3a'));
	});

	test('omits the file from the log when no single file is known to set the key', () => {
		const consoleError = mock.method(console, 'error', () => undefined);

		refusalOf({ esIndex: 4242424 });
		consoleError.mock.restore();

		assert.deepEqual(consoleError.mock.calls[0]?.arguments[2], { catalogue: 'alpha', key: 'esIndex' });
	});

	test('does not log under access_enforcement.startup_refused', () => {
		const consoleError = mock.method(console, 'error', () => undefined);

		refusalOf({ enableSets: 'true' });
		consoleError.mock.restore();

		const events = consoleError.mock.calls.map((call) => call.arguments[0]);
		assert.ok(!events.includes('access_enforcement.startup_refused'));
	});
});
