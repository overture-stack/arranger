import { parseArrangerConfigError, parseArrangerConfigSuccess } from './arrangerConfigParsing.js';

describe('parseArrangerConfigSuccess', () => {
	it('parses an available catalogue, normalizing catalogId to catalogueId', () => {
		const result = parseArrangerConfigSuccess({
			catalogId: 'donor',
			description: 'Donor records.',
			documentType: 'donor',
			fields: {},
			operators: {},
		});

		expect(result).toEqual({
			catalogueId: 'donor',
			description: 'Donor records.',
			documentType: 'donor',
			error: undefined,
			isLoading: false,
			status: 'available',
		});
	});

	it('parses a failed catalogue stub, keeping its structured error and already-correct catalogueId', () => {
		const result = parseArrangerConfigSuccess({
			catalogueId: 'mutation',
			documentType: 'records',
			error: { code: 'index_not_found', message: 'The configured search index could not be found.' },
			status: 'failed',
		});

		expect(result).toEqual({
			catalogueId: 'mutation',
			description: undefined,
			documentType: 'records',
			error: { code: 'index_not_found', message: 'The configured search index could not be found.' },
			isLoading: false,
			status: 'failed',
		});
	});

	it('defaults status to available when the response omits it entirely', () => {
		const result = parseArrangerConfigSuccess({ catalogId: 'donor', documentType: 'donor' });

		expect(result.status).toBe('available');
	});
});

describe('parseArrangerConfigError', () => {
	it('parses a 409 ambiguous_document_type error, keeping its structured error and matchingCatalogueIds', () => {
		const result = parseArrangerConfigError({
			response: {
				data: {
					documentType: 'records',
					error: {
						code: 'ambiguous_document_type',
						message: 'documentType "records" matches multiple catalogues; use the catalogue id instead.',
					},
					matchingCatalogueIds: ['mutation', 'correlation', 'protein', 'expression'],
				},
			},
		});

		expect(result).toEqual({
			error: {
				code: 'ambiguous_document_type',
				message: 'documentType "records" matches multiple catalogues; use the catalogue id instead.',
			},
			isLoading: false,
			matchingCatalogueIds: ['mutation', 'correlation', 'protein', 'expression'],
		});
	});

	it("normalizes a 404's bare error string into the structured shape, under a not_found code", () => {
		const result = parseArrangerConfigError({
			response: { data: { error: 'Catalogue "nonexistent" was not found.' } },
		});

		expect(result).toEqual({
			error: { code: 'not_found', message: 'Catalogue "nonexistent" was not found.' },
			isLoading: false,
			matchingCatalogueIds: undefined,
		});
	});

	it('falls back to a generic unknown_error when the error has no response data at all', () => {
		const result = parseArrangerConfigError(new Error('Network Error'));

		expect(result).toEqual({
			error: { code: 'unknown_error', message: 'Could not resolve this catalogue.' },
			isLoading: false,
			matchingCatalogueIds: undefined,
		});
	});
});
