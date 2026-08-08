import assert from 'node:assert';
import { suite, test } from 'node:test';

import Parallel from 'paralleljs';

import { hitsToEdges } from '#mapping/resolveHits.js';

import nestedFieldNames from './mockData/nestedFieldNames.json';
import expectedEdges from './mockData/wrangledExpectedEdges.json';
import hitsFixture from './mockData/wrangledHits.json';

// processChunk mutates each hit's `_source` in place; a fresh clone per test keeps that
// mutation from leaking into a later test that imports the same cached JSON module object
// (a real query never reuses a previously-mutated ES response the way two tests sharing one
// import would).
const cloneHits = () => structuredClone(hitsFixture);

const extendedFields = [
	{ fieldName: 'participants.available_data_types', isArray: true },
	{ fieldName: 'participants.family.family_compositions.available_data_types', isArray: true },
	{
		fieldName: 'participants.family.family_compositions.family_members.available_data_types',
		isArray: true,
	},
];

suite('mapping/hitsToEdges', () => {

	test('1.hitsToEdges should be accurate',
		(_unusedTestCtx, done) => {
			hitsToEdges({
				extendedFields,
				hits: cloneHits(),
				nestedFieldNames,
				Parallel
			})
				.then(({ results }) => {
					assert.deepEqual(results, expectedEdges);
					done();
				});
		}
	);

	test('2.hitsToEdges should not block process',
		async () => {
			let complete = false;

			try {
				const edgesPromise = hitsToEdges({
					extendedFields,
					hits: cloneHits(),
					nestedFieldNames,
					Parallel
				})
					.then(({ results }) => {
						complete = true;
						assert.deepEqual(results, expectedEdges);
					});

				// Verify it's non-blocking (this is what you want to test)
				assert.equal(complete, false);

				// Now wait for the promise to resolve before ending the test
				await edgesPromise;

				// Optional: verify it eventually completes
				assert.equal(complete, true);
			} catch (err) {
				assert.fail(`hitsToEdges test 2, error:\n${err}`);
			}
		}
	);

});

