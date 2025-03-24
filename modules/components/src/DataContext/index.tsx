// import type { ReactJSX } from '@emotion/react/dist/declarations/src/jsx-namespace.js';
import type { jsx } from '@emotion/react';
import { isEqual } from 'lodash-es';
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactElement } from 'react';

import { ThemeProvider } from '#ThemeContext/index.js';
import defaultApiFetcher from '#utils/api.js';
import { ARRANGER_API, DEBUG } from '#utils/config.js';
import getComponentDisplayName from '#utils/getComponentDisplayName.js';
import missingProviderHandler from '#utils/missingProvider.js';
import { emptyObj } from '#utils/noops.js';

import { useConfigs, useDataFetcher } from './helpers.js';
import type { DataContextInterface, DataProviderProps, SQONType, UseDataContextProps } from './types.js';

export const DataContext = createContext<DataContextInterface>({
	documentType: '',
	missingProvider: 'DataContext',
} as DataContextInterface);

/** Context provider for Arranger's data and functionality
 * @param {APIFetcherFn} [customFetcher=apiFetcher] function to make customised request and subsequent data handling (e.g. middlewares).
 * @param {string} [documentType] the GraphQL field that Arranger should use to collect the data for this provider.
 * @param {object} [legacyProps] allows passing items currently managed by `<Arranger />`, to ease migration. For maintainer use only.
 * **Highly discouraged props, as it will be deprecated in an upcoming version.**
 * @param {Theme} [theme] allows giving the provider a custom version of the theme for the consumers.
 * @param {string} [url] customises where requests should be made by the data fetcher.
 */
export const DataProvider = ({
	apiUrl = ARRANGER_API,
	children,
	customFetcher: apiFetcher = defaultApiFetcher,
	documentType,
	legacyProps,
	theme,
}: DataProviderProps): ReactElement<DataContextInterface> => {
	const [sqon, setSQON] = useState<SQONType>(null);

	useEffect(() => {
		if (legacyProps?.sqon && !isEqual(legacyProps.sqon, sqon)) {
			DEBUG && console.log('setting sqon from legacyProps');
			setSQON(legacyProps?.sqon);
		}
	}, [legacyProps?.sqon, sqon]);

	const { downloadsConfigs, extendedMapping, facetsConfigs, isLoadingConfigs, tableConfigs } = useConfigs({
		apiFetcher,
		documentType,
	});

	const fetchData = useDataFetcher({
		apiFetcher,
		documentType,
		rowIdFieldName: tableConfigs?.rowIdFieldName,
		sqon,
		url: apiUrl,
	});

	const contextValues = {
		...legacyProps,
		apiFetcher,
		apiUrl,
		downloadsConfigs,
		extendedMapping,
		facetsConfigs,
		fetchData,
		documentType,
		isLoadingConfigs,
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

		type blah = jsx.JSX.LibraryManagedAttributes<ComponentType<typeof dataProps>, Props>;

		return <Component {...(dataProps as blah)} />;
	};

	ComponentWithData.displayName = `WithArrangerData(${callerName})`;

	return ComponentWithData;
};

if (process.env.NODE_ENV === 'development') {
	DataContext.displayName = 'ArrangerDataContext';
	DataProvider.displayName = 'ArrangerDataProvider';
}
