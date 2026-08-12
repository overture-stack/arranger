import type { ArrangerConfigResult } from './types.js';

/** Parses a successful (`200`) `GET /{catalogue}/introspection` response into `ArrangerConfigResult`.
 * Covers both response shapes the endpoint can return: the full field/operator listing for an
 * available catalogue (which calls the id field `catalogId`), and the minimal stub for a
 * `failed` catalogue (which calls it `catalogueId` and includes a structured `{code, message}`
 * `error`); both are normalized to one `catalogueId` field here so callers don't need to know
 * which shape they got. */
export const parseArrangerConfigSuccess = (data: Record<string, unknown>): ArrangerConfigResult => ({
	catalogueId: (data.catalogueId ?? data.catalogId) as string | undefined,
	description: data.description as string | undefined,
	documentType: data.documentType as string | undefined,
	error: data.error as ArrangerConfigResult['error'] | undefined,
	isLoading: false,
	status: (data.status as ArrangerConfigResult['status']) ?? 'available',
});

/** Parses a failed request (a thrown Axios-shaped error) into `ArrangerConfigResult`. Covers three
 * distinct shapes from the server: a `409 ambiguous_document_type` response (structured
 * `{code, message}` `error` plus `matchingCatalogueIds`), a `404` (a bare message *string* under
 * `error`, not the structured shape, since that path predates the structured error convention),
 * and anything else (network failure, unexpected server error) as a generic `unknown_error`. */
export const parseArrangerConfigError = (err: unknown): ArrangerConfigResult => {
	const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
	const rawError = data?.error;

	const error: ArrangerConfigResult['error'] =
		typeof rawError === 'string'
			? { code: 'not_found', message: rawError }
			: (rawError as ArrangerConfigResult['error']) ?? {
					code: 'unknown_error',
					message: 'Could not resolve this catalogue.',
				};

	return {
		error,
		isLoading: false,
		matchingCatalogueIds: data?.matchingCatalogueIds as string[] | undefined,
	};
};
