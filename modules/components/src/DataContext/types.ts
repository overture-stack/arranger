import { Dispatch, SetStateAction } from 'react';
import { Method } from 'axios';
import SQON from '@overture-stack/sqon-builder';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import { legacyProps } from '@/Arranger/Arranger';
import { CustomThemeType, ThemeOptions } from '@/ThemeContext/types';

export type DisplayType =
	| 'all'
	| 'bits'
	| 'boolean'
	| 'bytes'
	| 'date'
	| 'list'
	| 'nested'
	| 'number';

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
	query?: string | null;
	show: boolean;
	sortable: boolean;
	type?: DisplayType; // being deprecated
}

export interface ColumnSortingInterface {
	desc: boolean;
	fieldName: string;
}

export interface TableConfigsInterface {
	columns: ColumnMappingInterface[];
	defaultSorting: ColumnSortingInterface[];
	maxResultsWindow: number;
	rowIdFieldName: string;
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

export interface ConfigsInterface {
	extendedMapping: ExtendedMappingInterface[];
	tableConfigs: TableConfigsInterface & {
		columns: (string | ColumnMappingInterface)[];
		maxResultsWindow: number;
	};
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
	first?: number;
	offset?: number;
	sort?: any;
	sqon?: SQONType;
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

export type SQONType = SQON | null;

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
