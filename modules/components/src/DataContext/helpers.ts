import { useCallback, useEffect, useState } from 'react';

import columnsToGraphql from '@/utils/columnsToGraphql';
import { emptyObj } from '@/utils/noops';

import {
	APIFetcherFn,
	ConfigsInterface,
	ExtendedMappingInterface,
	FetchDataFn,
	SQONType,
	TableConfigsInterface,
} from './types';
import { componentConfigsQuery } from './dataQueries';

export const useConfigs = ({
	apiFetcher,
	documentType,
}: {
	apiFetcher: APIFetcherFn;
	configs?: ConfigsInterface;
	documentType: string;
}) => {
	const [isLoading, setIsLoading] = useState(true);
	const [documentMapping, setDocumentMapping] = useState({});
	const [downloadsConfigs, setDownloadsConfigs] = useState({});
	const [facetsConfigs, setFacetsConfigs] = useState({});
	const [tableConfigs, setTableConfigs] = useState<TableConfigsInterface>(
		emptyObj as TableConfigsInterface,
	);
	const [extendedMapping, setExtendedMapping] = useState<ExtendedMappingInterface[]>([]);

	useEffect(() => {
		apiFetcher({
			endpoint: `/graphql/ArrangerConfigsQuery`,
			body: {
				query: componentConfigsQuery(documentType, 'ArrangerConfigs'),
			},
		})
			.then((response) => {
				const {
					configs: { downloads, extended, facets, table },
					mapping = emptyObj,
				} = response?.data?.[documentType] || emptyObj;

				setDocumentMapping(mapping);
				setDownloadsConfigs(downloads);
				setExtendedMapping(extended);
				setFacetsConfigs(facets);
				setTableConfigs(table);
			})
			.catch((error) => console.warn(error))
			.finally(() => {
				setIsLoading(false);
			});
	}, [apiFetcher, documentType]);

	return {
		documentMapping,
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
	keyFieldName,
	sqon,
	url,
}: {
	apiFetcher: APIFetcherFn;
	documentType: string;
	keyFieldName?: string;
	sqon?: SQONType;
	url?: string;
}): FetchDataFn =>
	useCallback<FetchDataFn>(
		({ config, endpoint = `/graphql`, endpointTag = '', ...options } = emptyObj) =>
			apiFetcher({
				endpoint,
				endpointTag,
				body: columnsToGraphql({
					config: {
						keyFieldName, // use keyFieldName from server configs if available
						...config, // yet allow overwritting it at request time
					},
					documentType,
					sqon,
					...options,
				}),
				url,
			}).then((response) => {
				const hits = response?.data?.[documentType]?.hits || {};
				const data = (hits.edges || []).map((e: any) => e.node);
				const total = hits.total || 0;

				return { total, data };
			}),
		[apiFetcher, documentType, keyFieldName, sqon, url],
	);
