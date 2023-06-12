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
	const [downloadsConfigs, setDownloadsConfigs] = useState({});
	const [facetsConfigs, setFacetsConfigs] = useState({});
	const [tableConfigs, setTableConfigs] = useState<TableConfigsInterface>(
		emptyObj as TableConfigsInterface,
	);
	const [extendedMapping, setExtendedMapping] = useState<ExtendedMappingInterface[]>([]);

	useEffect(() => {
		apiFetcher({
			endpoint: `/graphql/Arranger-ConfigsQuery`,
			body: {
				query: componentConfigsQuery(documentType, 'ArrangerConfigs'),
			},
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
	}, [apiFetcher, documentType]);

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
	url,
}: {
	apiFetcher: APIFetcherFn;
	documentType: string;
	rowIdFieldName?: string;
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
						rowIdFieldName, // use rowIdFieldName from server configs if available
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
		[apiFetcher, documentType, rowIdFieldName, sqon, url],
	);
