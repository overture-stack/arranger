import { ComponentType } from 'react';

import { ColumnMappingInterface, SQONType } from '@/DataContext/types';
import { DropDownThemeProps } from '@/DropDown/types';
import { ColumnsDictionary, FieldList } from '@/Table/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { PrefixKeys } from '@/utils/types';

export type DownloadFn = (options: {
  url: any;
  params: any;
  method?: string;
  body?: Record<string, any>;
}) => () => Promise<void>;

export interface ExporterFileInterface {
  allColumnsDict: ColumnsDictionary;
  columns: ColumnMappingInterface[];
  documentType: string;
  exporterColumns?: string[];
  fileName: string;
  fileType: 'tsv' | string;
  maxRows: number;
  sqon: SQONType;
}

export interface ExporterFnProps {
  fileName?: string;
  files: ExporterFileInterface[];
  options?: Record<string, any>;
  selectedRows?: string[];
  url: string;
}

export type ExporterFn = (exporter: ExporterFnProps, downloadFn?: DownloadFn) => void;

export interface ExporterDetailsInterface {
  columns?: FieldList | null;
  downloadUrl?: string;
  fileName?: string;
  fn?: ExporterFn;
  label?: ComponentType | string;
  maxRows?: number;
  requiresRowSelection?: boolean;
}

export type CustomExportersInput = ExporterDetailsInterface & { fn?: ExporterFn | 'saveTSV' };

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
  clickHandler?: () => void;
  disabled: boolean;
}
