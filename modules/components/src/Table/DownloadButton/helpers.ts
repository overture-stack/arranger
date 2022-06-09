import { useEffect, useState } from 'react';

import { ColumnMappingInterface } from '@/DataContext/types';
import download from '@/utils/download';
import { emptyObj } from '@/utils/noops';

import {
  CustomExporterList,
  CustomExportersInput,
  ExporterDetailsInterface,
  ExporterFileInterface,
  ExporterFnProps,
  ProcessedExporterDetailsInterface,
  ProcessedExporterList,
} from './types';

export const saveTSV = async ({
  fileName = '',
  files = [],
  options = {},
  url = '',
}: ExporterFnProps) =>
  download({
    url,
    method: 'POST',
    params: {
      fileName,
      files: files.map(
        ({ allColumnsDict, columns, exporterColumns, ...file }: ExporterFileInterface) => ({
          ...file,
          columns: exporterColumns // if the component gave you custom columns to show
            ? Object.values(
                exporterColumns.length > 0 // if they ask for any specific columns
                  ? exporterColumns
                      .map(
                        (fieldName) =>
                          allColumnsDict[fieldName] || // get the column data from the extended configs
                          // or let the user know if the column isn't valid
                          console.info('Could not include a column into the file:', fieldName),
                      )
                      .filter((column) => column) // and then, use the valid ones
                  : allColumnsDict, // else, they're asking for all the columns
              )
            : columns.filter((column: ColumnMappingInterface) => column.show), // no custom columns, use admin's
        }),
      ),
      ...options,
    },
  });

const prefixExporter = (item: ExporterDetailsInterface) =>
  Object.entries(item).reduce(
    (exporterItem, [key, value]) => ({
      ...exporterItem,
      [`exporter${key[0].toUpperCase()}${key.slice(1)}`]: value,
    }),
    {} as ProcessedExporterDetailsInterface,
  );

const processExporter = (
  // type scapehatch for functionality convenience
  item = 'saveTSV' as any as CustomExportersInput,
): ProcessedExporterDetailsInterface =>
  (item as any) === 'saveTSV' ||
  item?.fn === 'saveTSV' ||
  // or if they give us a filename without giving us a function
  ('fileName' in item && !('fn' in item))
    ? {
        ...(item?.columns && Array.isArray(item.columns) && { exporterColumns: item?.columns }),
        exporterFileName: item?.fileName || 'unnamed.tsv',
        exporterFn: saveTSV,
        exporterLabel: item?.label || 'Export TSV',
        exporterMaxRows: item?.maxRows || 0,
        exporterRequiresRowSelection: item?.requiresRowSelection || false,
      }
    : prefixExporter(item);

export const useExporters = (customExporters?: CustomExporterList) => {
  const [hasMultiple, setHasMultiple] = useState<boolean>(false);
  const [exporters, setExporters] = useState<ProcessedExporterList>(
    emptyObj as ProcessedExporterList,
  );

  useEffect(() => {
    if (Array.isArray(customExporters)) {
      if (customExporters.length > 0) {
        setHasMultiple(customExporters.length > 1);
        setExporters(customExporters.filter((item) => item).map(processExporter));
      }
    } else {
      setExporters(processExporter(customExporters));
    }
  }, [customExporters]);

  return {
    exporterDetails: exporters,
    hasMultipleExporters: hasMultiple,
  };
};
