import { useCallback, useEffect, useState } from 'react';

import columnsToGraphql from '#utils/columnsToGraphql.js';
import { emptyObj } from '#utils/noops.js';

import { parseArrangerConfigError, parseArrangerConfigSuccess } from './arrangerConfigParsing.js';
import { componentConfigsQuery } from './dataQueries.js';
import type {
	APIFetcherFn,
	ArrangerConfigResult,
	ConfigsInterface,
	ExtendedMappingInterface,
	FetchDataFn,
	SQONType,
	TableConfigsInterface,
} from './types.js';

export const useConfigs = ({
	apiFetcher,
	apiUrl,
	documentType,
}: {
	apiFetcher: APIFetcherFn;
	apiUrl?: string;
	configs?: ConfigsInterface;
	/** Left empty while `DataProvider` is still resolving it via `useArrangerConfig`; the fetch is skipped until it's known. */
	documentType?: string;
}) => {
	const [isLoading, setIsLoading] = useState(true);
	const [downloadsConfigs, setDownloadsConfigs] = useState({});
	const [facetsConfigs, setFacetsConfigs] = useState({});
	const [tableConfigs, setTableConfigs] = useState<TableConfigsInterface>(emptyObj);
	const [extendedMapping, setExtendedMapping] = useState<ExtendedMappingInterface[]>([]);

	useEffect(() => {
		if (!documentType) {
			return;
		}

		apiFetcher({
			endpoint: `/graphql/Arranger-ConfigsQuery`,
			body: {
				query: componentConfigsQuery(documentType, 'ArrangerConfigs'),
			},
			url: apiUrl,
		})
			.then((response) => {
				const {
					configs: { downloads, extended, facets, table },
				} = response?.data?.[documentType] || emptyObj;

				setDownloadsConfigs(downloads);
				setExtendedMapping(extended);
				setFacetsConfigs(facets);
				setTableConfigs(table);
			})
			.catch((error) => console.warn(error))
			.finally(() => {
				setIsLoading(false);
			});
	}, [apiFetcher, documentType, apiUrl]);

	return {
		downloadsConfigs,
		extendedMapping,
		facetsConfigs,
		isLoadingConfigs: isLoading,
		tableConfigs,
	};
};

export const useDataFetcher = ({
	apiFetcher,
	documentType,
	rowIdFieldName,
	sqon,
	apiUrl,
}: {
	apiFetcher: APIFetcherFn;
	/** Left empty while `DataProvider` is still resolving it via `useArrangerConfig`; calling the returned function before it's known resolves to an empty result rather than sending a broken query. */
	documentType?: string;
	rowIdFieldName?: string;
	sqon?: SQONType;
	apiUrl?: string;
}): FetchDataFn =>
	useCallback<FetchDataFn>(
		({ config, endpoint = `/graphql`, endpointTag = '', ...options } = emptyObj) => {
			if (!documentType) {
				return Promise.resolve({ data: [], total: 0 });
			}

			return apiFetcher({
				endpoint,
				endpointTag,
				body: columnsToGraphql({
					config: {
						rowIdFieldName, // use rowIdFieldName from server configs if available
						...config, // yet allow overwritting it at request time
					},
					documentType,
					sqon,
					...options,
				}),
				url: apiUrl,
			}).then((response) => {
				const hits = response?.data?.[documentType]?.hits || {};
				const data = (hits.edges || []).map((e: any) => e.node);
				const total = hits.total || 0;

				return { total, data };
			});
		},
		[apiFetcher, documentType, rowIdFieldName, sqon, apiUrl],
	);

/** Resolves a catalogue's `documentType` (and validity/status) automatically via
 * `GET /{catalogue}/introspection`, the same endpoint the deprecated `hasValidConfig` GraphQL
 * query was replaced by (see `docs/migration/v3.1.md` in the Arranger repo). Used internally by
 * `DataProvider` when its `documentType` prop is omitted; also usable standalone by a consumer
 * that wants to validate one or more catalogues before rendering anything, the way `Stage`'s own
 * hand-rolled `hasValidConfig` has done in the past.
 *
 * No-ops entirely, with no request sent, when `catalogue` isn't given: this is the case for
 * every existing single-catalogue consumer that already passes `documentType` explicitly. */
export const useArrangerConfig = ({
	apiFetcher,
	apiUrl,
	catalogue,
}: {
	apiFetcher: APIFetcherFn;
	apiUrl?: string;
	catalogue?: string;
}): ArrangerConfigResult => {
	const [result, setResult] = useState<ArrangerConfigResult>({ isLoading: Boolean(catalogue) });

	useEffect(() => {
		if (!catalogue) {
			setResult({ isLoading: false });
			return;
		}

		// Cancels the request itself (not just its result) once a fetcher honours `signal`;
		// `signal.aborted` doubles as the stale-result guard below for one that doesn't.
		const controller = new AbortController();
		setResult((previous) => ({ ...previous, isLoading: true }));

		apiFetcher({ endpoint: `${catalogue}/introspection`, method: 'GET', signal: controller.signal, url: apiUrl })
			.then((response) => {
				if (!controller.signal.aborted) {
					setResult(parseArrangerConfigSuccess((response?.data ?? {}) as Record<string, unknown>));
				}
			})
			.catch((error) => {
				if (!controller.signal.aborted) {
					setResult(parseArrangerConfigError(error));
				}
			});

		return () => {
			controller.abort();
		};
	}, [apiFetcher, apiUrl, catalogue]);

	return result;
};
