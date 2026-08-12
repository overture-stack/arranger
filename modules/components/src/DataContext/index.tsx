// import type { ReactJSX } from '@emotion/react/dist/declarations/src/jsx-namespace.js';
import type { jsx } from '@emotion/react';
import { isEqual } from 'lodash-es';
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactElement } from 'react';
import urlJoin from 'url-join';

import { ThemeProvider } from '#ThemeContext/index.js';
import defaultApiFetcher from '#utils/api.js';
import { ARRANGER_API, DEBUG } from '#utils/config.js';
import getComponentDisplayName from '#utils/getComponentDisplayName.js';
import missingProviderHandler from '#utils/missingProvider.js';
import { emptyObj } from '#utils/noops.js';

import { useArrangerConfig, useConfigs, useDataFetcher } from './helpers.js';
import type { DataContextInterface, DataProviderProps, SQONType, UseDataContextProps } from './types.js';

export { useArrangerConfig } from './helpers.js';

export const DataContext = createContext<DataContextInterface>({
	documentType: '',
	missingProvider: 'DataContext',
} as DataContextInterface);

/** Context provider for Arranger's data and functionality
 * @param {string} [catalogue] scopes this provider to a single catalogue when the Arranger server is running in multicatalogue mode. Also required, instead of `documentType`, to have `documentType` resolved automatically; see that param.
 * @param {APIFetcherFn} [customFetcher=apiFetcher] function to make customised request and subsequent data handling (e.g. middlewares). Must honour the `url` field it's called with; see `APIFetcherFn`'s own TSDoc.
 * @param {string} [documentType] the GraphQL field that Arranger should use to collect the data for this provider. When omitted, `catalogue` is required, and `documentType` (along with validity/status) is resolved automatically via `useArrangerConfig`, at the cost of one extra request before real queries can start.
 * @param {object} [legacyProps] allows passing items currently managed by `<Arranger />`, to ease migration. For maintainer use only.
 * **Highly discouraged props, as it will be deprecated in an upcoming version.**
 * @param {Theme} [theme] allows giving the provider a custom version of the theme for the consumers.
 * @param {string} [apiUrl] customises where requests should be made by the data fetcher.
 */
export const DataProvider = ({
	apiUrl = ARRANGER_API,
	catalogue,
	children,
	customFetcher: apiFetcher = defaultApiFetcher,
	documentType: explicitDocumentType,
	legacyProps,
	theme,
}: DataProviderProps): ReactElement<DataContextInterface> => {
	const [sqon, setSQON] = useState<SQONType>(null);
	const [networkNodesFilter, setNetworkNodesFilter] = useState<string[]>([]);

	useEffect(() => {
		if (legacyProps?.sqon && !isEqual(legacyProps.sqon, sqon)) {
			DEBUG && console.log('setting sqon from legacyProps');
			setSQON(legacyProps?.sqon);
		}
	}, [legacyProps?.sqon, sqon]);

	if (process.env.NODE_ENV === 'development' && !explicitDocumentType && !catalogue) {
		console.warn(
			'ArrangerDataProvider: neither `documentType` nor `catalogue` was given. One of the two is required: ' +
				'`documentType` directly, or `catalogue` to have it resolved automatically.',
		);
	}

	const resolvedApiUrl = catalogue ? urlJoin(apiUrl, catalogue) : apiUrl;

	const arrangerConfig = useArrangerConfig({
		apiFetcher,
		apiUrl,
		// Skip the lookup entirely when documentType is already known; matches every existing
		// single-catalogue consumer, unchanged, with no added request.
		catalogue: explicitDocumentType ? undefined : catalogue,
	});

	const documentType = explicitDocumentType ?? arrangerConfig.documentType;

	const { downloadsConfigs, extendedMapping, facetsConfigs, isLoadingConfigs: isLoadingComponentConfigs, tableConfigs } =
		useConfigs({
			apiFetcher,
			documentType,
			apiUrl: resolvedApiUrl,
		});

	const fetchData = useDataFetcher({
		apiFetcher,
		documentType,
		rowIdFieldName: tableConfigs?.rowIdFieldName,
		sqon,
		apiUrl: resolvedApiUrl,
	});

	const contextValues = {
		...legacyProps,
		apiFetcher,
		apiUrl: resolvedApiUrl,
		catalogue,
		catalogueError: explicitDocumentType ? undefined : arrangerConfig.error,
		downloadsConfigs,
		extendedMapping,
		facetsConfigs,
		fetchData,
		documentType: documentType ?? '',
		isLoadingConfigs: isLoadingComponentConfigs || arrangerConfig.isLoading,
		networkNodesFilter,
		setNetworkNodesFilter,
		setSQON,
		sqon,
		tableConfigs,
	};

	return (
		<DataContext.Provider value={contextValues}>
			<ThemeProvider theme={theme}>{children}</ThemeProvider>
		</DataContext.Provider>
	);
};

/** hook for data access and aggregation
 * @param {string} [callerName] (optional) usually your component name. used to assist troubleshooting context issues.
 * @param {FetchDataFn} [customFetcher] (optional) takes a custom data fetching function to override requests locally.
 * @returns {DataContextInterface} data object
 */
export const useDataContext = ({
	apiUrl: localApiUrl,
	callerName,
	customFetcher: localFetcher,
}: UseDataContextProps = emptyObj): DataContextInterface => {
	const defaultContext = useContext(DataContext);

	defaultContext.missingProvider && missingProviderHandler(DataContext.displayName, callerName);

	return {
		...defaultContext,
		apiUrl: localApiUrl || defaultContext?.apiUrl,
		fetchData: localFetcher || defaultContext?.fetchData,
	};
};

/** HOC for data access */
export const withData = <Props extends Omit<Props, keyof DataContextInterface>>(Component: ComponentType<Props>) => {
	// UseDataContextProps;
	const callerName = getComponentDisplayName(Component);
	const ComponentWithData = (props) => {
		const dataProps = {
			...props,
			...useDataContext({ callerName }),
		};

		type DataProps = jsx.JSX.LibraryManagedAttributes<ComponentType<typeof dataProps>, Props>;

		return <Component {...(dataProps as DataProps)} />;
	};

	ComponentWithData.displayName = `WithArrangerData(${callerName})`;

	return ComponentWithData;
};

if (process.env.NODE_ENV === 'development') {
	DataContext.displayName = 'ArrangerDataContext';
	DataProvider.displayName = 'ArrangerDataProvider';
}
