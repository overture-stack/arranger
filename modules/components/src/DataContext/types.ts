import type { SQON } from '@overture-stack/sqon-builder';
import type { AxiosResponse, Method } from 'axios';
import type { Dispatch, SetStateAction } from 'react';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import type { legacyProps } from '#Arranger/Arranger.js';
import type { UnorderedListStyles } from '#Table/types.js';
import type { CustomThemeType, ThemeOptions } from '#ThemeContext/types/index.js';

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'nested' | 'number';

export type ColumnCustomiserFn = <Output>(input: ExtendedMappingInterface) => Output;

export interface ColumnMappingInterface {
	accessor: string;
	canChangeShow: boolean;
	displayFormat?: string | null;
	displayName?: string;
	displayType: DisplayType;
	displayValues?: Record<string, string>;
	fieldName: string;
	id: string;
	isArray?: boolean;
	jsonPath?: string | null;
	listStyle?: UnorderedListStyles;
	query?: string | null;
	show: boolean;
	sortable: boolean;
	type?: DisplayType; // being deprecated
}

export interface ColumnSortingInterface {
	desc: boolean;
	fieldName: string;
}

export interface ExtendedMappingInterface {
	displayName: string;
	displayType: string;
	displayValues: Record<string, string>;
	fieldName: string;
	isActive: boolean; // TODO: what does this do?
	isArray: boolean;
	quickSearchEnabled: boolean;
	rangeStep: number | null | undefined;
	type: DisplayType;
	unit: string | null;
}

export interface FacetsConfigsInterface {
	displayName: string;
	displayType: string;
	fieldName: string;
	isActive: boolean;
	show: boolean;
}

export interface TableConfigsInterface {
	columns: ColumnMappingInterface[];
	defaultSorting: ColumnSortingInterface[];
	maxResultsWindow: number;
	rowIdFieldName: string;
}

export interface ConfigsInterface {
	extendedMapping: ExtendedMappingInterface[];
	facetsConfigs: FacetsConfigsInterface;
	tableConfigs: TableConfigsInterface & {
		columns: (string | ColumnMappingInterface)[];
	};
}

export type APIFetcherFn = (options: {
	body: unknown;
	endpoint?: string;
	endpointTag?: string;
	headers?: Record<string, string>;
	method?: Method;
	url?: string;
}) => Promise<AxiosResponse<unknown>>;

export type SQONType = SQON | null;

export type FetchDataFn = (options?: {
	config?: Record<string, any>;
	endpoint?: string;
	endpointTag?: string;
	first?: number;
	offset?: number;
	sort?: any;
	sqon?: SQONType;
	queryName?: string;
}) => Promise<{ total?: number; data?: any } | undefined>;

export interface DataProviderProps<Theme = ThemeOptions> {
	apiUrl: string;
	children?: React.ReactNode;
	configs?: ConfigsInterface;
	customFetcher?: APIFetcherFn;
	documentType: string;
	legacyProps?: typeof legacyProps; // TODO: deprecate along with <Arranger/>
	theme?: CustomThemeType<Theme>;
}

export interface DataContextInterface {
	apiFetcher: APIFetcherFn;
	apiUrl: string;
	documentType: string;
	extendedMapping: ExtendedMappingInterface[];
	fetchData: FetchDataFn;
	isLoadingConfigs: boolean;
	missingProvider?: string;
	sqon: SQONType;
	setSQON: Dispatch<SetStateAction<SQONType>>;
	tableConfigs: TableConfigsInterface;
}

export interface UseDataContextProps {
	apiUrl?: string;
	callerName?: string;
	customFetcher?: FetchDataFn;
}
