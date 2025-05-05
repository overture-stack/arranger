import type { ComponentType, ReactNode } from 'react';
import type { Merge } from 'type-fest';

import type { ThemedButtonProps } from '#Button/types.js';
import type { ColumnMappingInterface, SQONType } from '#DataContext/types.js';
import type { DropDownThemeProps } from '#DropDown/types.js';
import type { ColumnsDictionary } from '#Table/types.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import type { PrefixKeys, RecursivePartial, TypesUnionPropertiesOfInterface } from '#utils/types.js';

export interface TableColumnMappingInterface extends ColumnMappingInterface {
	Header: ReactNode;
}

// export type blah = 'meep';

export type CustomColumnMappingInterface = TypesUnionPropertiesOfInterface<
	Partial<TableColumnMappingInterface>,
	(TableColumnMappingInterface: any) => any
>;

type ExporterColumnMappingInterface = (string | CustomColumnMappingInterface)[] | null;

export interface ExporterFileInterface {
	allColumnsDict: ColumnsDictionary;
	columns: ExporterColumnMappingInterface;
	documentType: string;
	exporterColumns?: ExporterColumnMappingInterface;
	fileName: string;
	fileType: 'tsv' | string;
	maxRows: number;
	sqon: SQONType;
	valueWhenEmpty: ReactNode;
}

export interface ExporterFunctionProps {
	fileName?: string;
	files: ExporterFileInterface[];
	options?: Record<string, any>;
	selectedRows: string[];
	sqon: SQONType;
	url: string;
}

export type DownloadFunction = (options: {
	url: any;
	params: any;
	method?: string;
	body?: Record<string, any>;
}) => () => Promise<void>;

export type ExporterFunction = (exporter: ExporterFunctionProps, downloadFunction?: DownloadFunction) => void;

export interface ExporterDetailsInterface {
	columns?: ExporterColumnMappingInterface;
	downloadUrl?: string;
	fileName?: string;
	function?: ExporterFunction;
	label?: ComponentType | string;
	maxRows?: number;
	requiresRowSelection?: boolean;
	valueWhenEmpty?: ReactNode;
}

export type ExporterInput = ExporterDetailsInterface | ExporterDetailsInterface[];

export type ProcessedExporterDetailsInterface = PrefixKeys<ExporterDetailsInterface, 'exporter'>;
export type ProcessedExporterInput = ProcessedExporterDetailsInterface | ProcessedExporterDetailsInterface[];

export type CustomExporterDetailsInterface =
	| Merge<
			ExporterDetailsInterface,
			{
				function?: ExporterFunction | 'saveTSV';
			}
	  >
	| 'saveTSV';
export type CustomExporterInput = CustomExporterDetailsInterface | CustomExporterDetailsInterface[];

export interface ExporterCustomisationProps {
	downloadUrl: string;
	exportSelectedRowsField: string;
	maxRows: number;
	label: ComponentType | string | number;
}

export interface DownloadBaseButtonThemeProps extends ExporterCustomisationProps, ThemedButtonProps {}

export interface DownloadButtonThemeProps extends DownloadBaseButtonThemeProps, DropDownThemeProps {
	customExporters: CustomExporterInput;
	disableRowSelection: boolean;
}

export interface DownloadButtonProps extends ThemeCommon.CustomCSS {
	theme?: RecursivePartial<DownloadButtonThemeProps>;
}

export interface SingleDownloadButtonProps extends Partial<ProcessedExporterDetailsInterface> {
	className?: string;
	clickHandler?: () => void;
	disabled: boolean;
	theme?: RecursivePartial<DownloadBaseButtonThemeProps>;
}
