import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { stringToBool } from '@overture-stack/arranger-types/tools';

import { adminFlagNotice } from './adminFlag.js';

/** The notice for an ENABLE_ADMIN value, which 3.1's own boolean rule reads, as the server does. */
const noticeFor = (value: string | undefined) => adminFlagNotice({ enabled: stringToBool(value), value });

suite('adminFlagNotice: an ENABLE_ADMIN value 3.0 read as off, and 3.1 reads as on', () => {
	// `true\r` is what a .env file saved with Windows line endings holds.
	['1', ' 1 ', ' true ', 'true\r'].forEach((value) => {
		test(`warns for ${JSON.stringify(value)}, saying admin is on and how to keep it on without the notice`, () => {
			const notice = noticeFor(value);

			assert.equal(notice?.code, 'ARRANGER_ENV_MEANING_CHANGED');
			assert.match(notice?.message ?? '', /^ENABLE_ADMIN turns admin on, .*though 3\.0 read its value as off/);
			assert.match(notice?.message ?? '', /Set it to `true` to keep admin on without this notice, or remove it/);
			assert.match(notice?.message ?? '', /#boolean-environment-flags$/);
		});
	});

	test('never repeats the value it was given', () => {
		assert.doesNotMatch(noticeFor(' 1 ')?.message ?? '', /" 1 "/);
	});
});

suite('adminFlagNotice: any other ENABLE_ADMIN value', () => {
	// `TRUE` read as on in 3.0 too, `yes` is a value 3.1 ignores, leaving admin off.
	['true', 'TRUE', 'false', '0', '', 'yes', undefined].forEach((value) => {
		test(`prints nothing for ${JSON.stringify(value)}, which 3.0 and 3.1 read alike`, () => {
			assert.equal(noticeFor(value), undefined);
		});
	});
});
