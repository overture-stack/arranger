import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import mappingToNestedTypes from './mappingToNestedTypes.js';
import { buildGraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

suite('mappingToNestedTypes', () => {
	test('sanitizes a hyphenated nested field name into a valid GraphQL field and type name', () => {
		const mapping = {
			biomarker: {
				type: 'nested',
				properties: {
					'ca19-9_level': { type: 'keyword' },
					alc: { type: 'integer' },
				},
			},
		};
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [
				{ fieldName: 'biomarker' },
				{ fieldName: 'biomarker.ca19-9_level' },
				{ fieldName: 'biomarker.alc' },
			],
		});

		const [sdl] = mappingToNestedTypes('Donor', mapping, '', [], registry);

		// The child type is named from the sanitized leaf, not the raw field name.
		assert.match(sdl, /type DonorBiomarker \{/);
		// The hyphenated field is exposed under its sanitized name, in both the main type...
		assert.match(sdl, /ca19_9_level: String/);
		// ...and the aggregations type (a separate code path, previously left unfixed).
		assert.match(sdl, /ca19_9_level: Aggregations/);
		// ...and the raw, invalid name never appears anywhere in the generated SDL.
		assert.ok(!sdl.includes('ca19-9_level'));
		// An already-valid sibling field name passes through unchanged.
		assert.match(sdl, /alc: Float/);
	});

	test('does not collapse two nested fields under the same parent when their sanitized names differ', () => {
		const mapping = {
			biomarker: {
				type: 'nested',
				properties: {
					'pd-l1_status': { type: 'keyword' },
					'pan-trk_ihc_status': { type: 'keyword' },
				},
			},
		};
		const registry = buildGraphqlNameRegistry({
			documentType: 'donor',
			fieldsFromMapping: [
				{ fieldName: 'biomarker' },
				{ fieldName: 'biomarker.pd-l1_status' },
				{ fieldName: 'biomarker.pan-trk_ihc_status' },
			],
		});

		const [sdl] = mappingToNestedTypes('Donor', mapping, '', [], registry);

		assert.match(sdl, /pd_l1_status: String/);
		assert.match(sdl, /pan_trk_ihc_status: String/);
	});
});
