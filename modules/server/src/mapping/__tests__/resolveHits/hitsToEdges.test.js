import assert from 'node:assert';
import { suite, test } from 'node:test';

import Parallel from 'paralleljs';

import { hitsToEdges } from '#mapping/resolveHits';

import nestedFieldNames from './mockData/nestedFieldNames.json';
import expectedEdges from './mockData/wrangledExpectedEdges.json';
import hits from './mockData/wrangledHits.json';

suite('mapping/hitsToEdges', () => {

	test('1.hitsToEdges should be accurate',
		(_unusedTestCtx, done) => {
			hitsToEdges({
				hits,
				nestedFieldNames,
				Parallel
			})
				.then((edges) => {
					assert.deepEqual(edges, expectedEdges);
					done();
				});
		}
	);

	test('2.hitsToEdges should not block process',
		async () => {
			let complete = false;

			try {
				const edgesPromise = hitsToEdges({
					hits,
					nestedFieldNames,
					Parallel
				})
					.then((edges) => {
						complete = true;
						assert.deepEqual(edges, expectedEdges);
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

