import { useEffect, useState } from 'react';

import { ColumnMappingInterface, ExtendedMappingInterface } from '@/DataContext/types';
import download from '@/utils/download';
import { emptyObj } from '@/utils/noops';

import {
	CustomExporterList,
	CustomExportersInput,
	ExporterDetailsInterface,
	ExporterFileInterface,
	ExporterFunctionProps,
	ProcessedExporterDetailsInterface,
	ProcessedExporterList,
} from './types';

const useCustomisers =
	(extendedColumn: ExtendedMappingInterface) =>
	([customiserLabel, customiserValue]: [
		key: string,
		value: any,
	]): Partial<ColumnMappingInterface> => {
		return (
			customiserValue && {
				[customiserLabel]:
					typeof customiserValue === 'function' ? customiserValue(extendedColumn) : customiserValue,
			}
		);
	};

export const saveTSV = async ({
	fileName = '',
	files = [],
	options = {},
	url = '',
}: ExporterFunctionProps) =>
	download({
		url,
		method: 'POST',
		...options,
		params: {
			fileName,
			files: files.map(
				({ allColumnsDict, columns, exporterColumns = null, ...file }: ExporterFileInterface) => ({
					...file,
					columns: exporterColumns // if the component gave you custom columns to show
						? Object.values(
								exporterColumns.length > 0 // if they ask for any specific columns
									? // use them
									  exporterColumns.map((column) => {
											switch (typeof column) {
												// checking if each column is customised
												case 'object': {
													const extendedColumn = allColumnsDict[column.fieldName];
													const useExtendedCustomisers = useCustomisers(extendedColumn);

													return {
														...extendedColumn,
														...Object.entries(column).reduce(
															(customisers, customiser: ColumnCustomiserTuple) => ({
																...customisers,
																...useExtendedCustomisers(customiser),
															}),
															{},
														),
													};
												}

												// or not
												case 'string':
												default:
													return allColumnsDict[column];
											}
									  })
									: allColumnsDict, // else, they're asking for all the columns
						  )
						: columns.filter((column) => column.show), // no custom columns, use admin's
				}),
			),
			...options.params,
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
	item?.function === 'saveTSV' ||
	// or if they give us a filename without giving us a function
	('fileName' in item && !('fn' in item))
		? {
				...(item?.columns && Array.isArray(item.columns) && { exporterColumns: item?.columns }),
				exporterFileName: item?.fileName || 'unnamed.tsv',
				exporterFunction: saveTSV,
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
