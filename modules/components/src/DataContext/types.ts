import { Dispatch, SetStateAction } from 'react';
import { Method } from 'axios';
import SQON from 'sqon-builder';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import { legacyProps } from '@/Arranger/Arranger';
import { CustomThemeType, ThemeOptions } from '@/ThemeContext/types';

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'number';

export interface ColumnMappingInterface {
	accessor: string;
	canChangeShow: boolean;
	displayFormat?: string | null;
	displayName?: string;
	displayValues?: Record<string, string>;
	fieldName: string;
	id: string;
	isArray?: boolean;
	jsonPath?: string | null;
	query?: string | null;
	show: boolean;
	sortable: boolean;
	type: DisplayType;
}

export interface ColumnSortingInterface {
	desc: boolean;
	fieldName: string;
}

export interface TableConfigsInterface {
	columns: ColumnMappingInterface[];
	defaultSorting: ColumnSortingInterface[];
	keyFieldName: string;
}

export interface ExtendedMappingInterface {
	active: boolean; // *
	displayName: string;
	displayType: string;
	displayValues: Record<string, string>;
	fieldName: string;
	isArray: boolean;
	primaryKey: boolean;
	quickSearchEnabled: boolean;
	rangeStep: number | null | undefined;
	type: DisplayType;
	unit: string | null;
}

export interface ConfigsInterface {
	extendedMapping: ExtendedMappingInterface[];
	tableConfigs: TableConfigsInterface;
}

export type APIFetcherFn = (options: {
	body: any;
	endpoint?: string;
	endpointTag?: string;
	headers?: Record<string, string>;
	method?: Method;
	url?: string;
}) => Promise<any>;

export type FetchDataFn = (options?: {
	config?: Record<string, any>;
	endpoint?: string;
	endpointTag?: string;
	first?: any;
	offset?: any;
	sort?: any;
	sqon?: any;
	queryName?: string;
}) => Promise<{ total?: number; data?: any } | void>;

export interface DataProviderProps<Theme = ThemeOptions> {
	apiUrl: string;
	children?: React.ReactNode;
	configs?: ConfigsInterface;
	customFetcher?: APIFetcherFn;
	documentType: string;
	legacyProps?: typeof legacyProps; // TODO: deprecate along with <Arranger/>
	theme?: CustomThemeType<Theme>;
}

export type SQONType = typeof SQON | null;

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
