import { ComponentType, ReactNode } from 'react';
import type { Merge } from 'type-fest';

import { ColumnMappingInterface, SQONType } from '@/DataContext/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { ColumnsDictionary, FieldList } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { PrefixKeys, WithFunctionOptions, TypesUnionPropertiesOfInterface } from '@/utils/types';

export type DownloadFunction = (options: {
	url: any;
	params: any;
	method?: string;
	body?: Record<string, any>;
}) => () => Promise<void>;

export interface ExporterFileInterface {
	allColumnsDict: ColumnsDictionary;
	columns: ColumnMappingInterface[];
	documentType: string;
	exporterColumns?: (ColumnMappingInterface['fieldName'] | ColumnMappingInterface)[] | null;
	fileName: string;
	fileType: 'tsv' | string;
	maxRows: number;
	sqon: SQONType;
}

export interface ExporterFunctionProps {
	fileName?: string;
	files: ExporterFileInterface[];
	options?: Record<string, any>;
	selectedRows: string[];
	url: string;
}

export type ExporterFunction = (
	exporter: ExporterFunctionProps,
	downloadFunction?: DownloadFunction,
) => void;

export interface TableColumnMappingInterface extends ColumnMappingInterface {
	Header: ReactNode;
}

export type CustomColumnMappingInterface = TypesUnionPropertiesOfInterface<
	Partial<TableColumnMappingInterface>,
	(TableColumnMappingInterface: any) => any
>;

// export type CustomColumnMappingInterface = WithFunctionOptions<Partial<ColumnMappingInterface>>;
// export type CustomColumnMappingInterface = WithFunctionOptions<Partial<ExtendedMappingInterface>>;

export interface ExporterDetailsInterface {
	columns?: (string | CustomColumnMappingInterface)[] | null;
	downloadUrl?: string;
	fileName?: string;
	function?: ExporterFunction;
	label?: ComponentType | string;
	maxRows?: number;
	requiresRowSelection?: boolean;
	valueWhenEmpty?: ReactNode;
}

export type CustomExportersInput = Merge<
	ExporterDetailsInterface,
	{
		function?: ExporterFunction | 'saveTSV';
	}
>;

export type ProcessedExporterDetailsInterface = PrefixKeys<ExporterDetailsInterface, 'exporter'>;

export type CustomExporterList = CustomExportersInput | CustomExportersInput[];
export type ExporterList = ExporterDetailsInterface | ExporterDetailsInterface[];
export type ProcessedExporterList =
	| ProcessedExporterDetailsInterface
	| ProcessedExporterDetailsInterface[];

export interface ExporterCustomisationProps {
	customExporters: CustomExporterList;
	downloadUrl: string;
	maxRows: number;
	label: ThemeCommon.ChildrenType;
}

export interface DownloadButtonThemeProps extends ExporterCustomisationProps, DropDownThemeProps {
	disableRowSelection: boolean;
}

export interface DownloadButtonProps extends ThemeCommon.CustomCSS {
	theme?: Partial<DownloadButtonThemeProps>;
}

export interface SingleDownloadButtonProps extends Partial<ProcessedExporterDetailsInterface> {
	className?: string;
	clickHandler?: () => void;
	disabled: boolean;
}
