import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import findCatalogueByIdentifier from './findCatalogueByIdentifier.js';

suite('findCatalogueByIdentifier', () => {
	test('resolves an exact catalogueId match without consulting documentType at all', () => {
		const result = findCatalogueByIdentifier({
			catalogs: { donor: { documentType: 'donor' } },
			identifier: 'donor',
		});

		assert.deepEqual(result, { catalogueId: 'donor', outcome: 'matched' });
	});

	test('a literal catalogueId match wins even if it also happens to equal another catalogue\'s documentType', () => {
		const result = findCatalogueByIdentifier({
			catalogs: {
				donor: { documentType: 'donor' },
				records: { documentType: 'donor' },
			},
			identifier: 'records',
		});

		assert.deepEqual(result, { catalogueId: 'records', outcome: 'matched' });
	});

	test('resolves a documentType that names exactly one catalogue', () => {
		const result = findCatalogueByIdentifier({
			catalogs: {
				donor: { documentType: 'donor' },
				mutation: { documentType: 'records' },
			},
			identifier: 'records',
		});

		assert.deepEqual(result, { catalogueId: 'mutation', outcome: 'matched' });
	});

	test('reports not_found when the identifier matches neither a catalogueId nor any documentType', () => {
		const result = findCatalogueByIdentifier({
			catalogs: { donor: { documentType: 'donor' } },
			identifier: 'nonexistent',
		});

		assert.deepEqual(result, { outcome: 'not_found' });
	});

	test('reports ambiguous, with every matching catalogueId, when a documentType is shared by several catalogues', () => {
		const result = findCatalogueByIdentifier({
			catalogs: {
				correlation: { documentType: 'records' },
				expression: { documentType: 'records' },
				mutation: { documentType: 'records' },
				protein: { documentType: 'records' },
			},
			identifier: 'records',
		});

		assert.equal(result.outcome, 'ambiguous');
		assert.deepEqual(
			(result as { matchingCatalogueIds: string[] }).matchingCatalogueIds.sort(),
			['correlation', 'expression', 'mutation', 'protein'],
		);
	});
});
