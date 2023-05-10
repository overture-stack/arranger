import { ComponentType, ReactNode } from 'react';
import type { Merge } from 'type-fest';

import { ColumnMappingInterface, SQONType } from '@/DataContext/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { ColumnsDictionary } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { PrefixKeys, RecursivePartial, TypesUnionPropertiesOfInterface } from '@/utils/types';
import { ThemedButtonProps } from '@/Button/types';

export interface TableColumnMappingInterface extends ColumnMappingInterface {
	Header: ReactNode;
}

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
	url: string;
}

export type DownloadFunction = (options: {
	url: any;
	params: any;
	method?: string;
	body?: Record<string, any>;
}) => () => Promise<void>;

export type ExporterFunction = (
	exporter: ExporterFunctionProps,
	downloadFunction?: DownloadFunction,
) => void;

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
export type ProcessedExporterInput =
	| ProcessedExporterDetailsInterface
	| ProcessedExporterDetailsInterface[];

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
	maxRows: number;
	label: ReactNode;
}

export interface DownloadBaseButtonThemeProps
	extends ExporterCustomisationProps,
		ThemedButtonProps {}

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
