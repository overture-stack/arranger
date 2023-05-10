import { useEffect, useState } from 'react';

import { ColumnMappingInterface } from '@/DataContext/types';
import download from '@/utils/download';
import { emptyObj } from '@/utils/noops';

import {
	CustomExporterDetailsInterface,
	CustomExporterInput,
	ExporterFileInterface,
	ExporterFunctionProps,
	ProcessedExporterDetailsInterface,
	ProcessedExporterInput,
} from './types';

const useCustomisers =
	(extendedColumn: ColumnMappingInterface) =>
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
				({ allColumnsDict, columns, exporterColumns, ...file }: ExporterFileInterface) => ({
					...file,
					columns: exporterColumns // if the component gave you custom columns to show
						? Object.values(
								exporterColumns.length > 0 // if they ask for any specific columns
									? // use them
									  exporterColumns.map((column) => {
											switch (typeof column) {
												// checking if each column is customised
												case 'object': {
													const fieldName =
														typeof column.fieldName === 'function'
															? column.fieldName?.(column)
															: column.fieldName;

													const extendedColumn = allColumnsDict[fieldName];
													const useExtendedCustomisers = useCustomisers(extendedColumn);

													return {
														...extendedColumn,
														...Object.entries(column).reduce(
															(customisers, customiser) => ({
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
						: columns?.filter((column) => typeof column === 'object' && column.show), // no custom columns, use admin's
				}),
			),
			...options.params,
		},
	});

const prefixExporter = (item: CustomExporterDetailsInterface): ProcessedExporterDetailsInterface =>
	Object.entries(item).reduce(
		(exporterItem, [key, value]) => ({
			...exporterItem,
			[`exporter${key[0].toUpperCase()}${key.slice(1)}`]: value,
		}),
		{},
	);

const processExporter = (
	// type scapehatch for functionality convenience
	item: CustomExporterDetailsInterface,
): ProcessedExporterDetailsInterface => {
	// default values for an exporter
	const baseExporter = {
		// downloadUrl?
		exporterFileName: 'unnamed.tsv',
		exporterFunction: saveTSV,
		exporterLabel: 'Export TSV',
		exporterMaxRows: 0,
		exporterRequiresRowSelection: false,
	};

	// if they want to use the internal saveTSV function with its default settings
	if (item === 'saveTSV') return baseExporter;

	if (
		item?.function === 'saveTSV' || // or using the internal saveTSV function, while customising things
		('fileName' in item && !('function' in item)) // or they pass a filename without a custom function
	) {
		const { columns, fileName, label, maxRows, requiresRowSelection, valueWhenEmpty } = item;

		return {
			...baseExporter,
			...(columns && Array.isArray(columns) && { exporterColumns: columns }),
			...(fileName && { exporterFileName: fileName }),
			...(label && { exporterLabel: label }),
			...(maxRows && { exporterMaxRows: maxRows }),
			...(requiresRowSelection && { exporterRequiresRowSelection: requiresRowSelection }),
			...(valueWhenEmpty && { exporterValueWhenEmpty: valueWhenEmpty }),
		};
	}

	return prefixExporter(item);
};

export const useExporters = (customExporters?: CustomExporterInput) => {
	const [hasMultiple, setHasMultiple] = useState<boolean>(false);
	const [exporters, setExporters] = useState<ProcessedExporterInput>(emptyObj);

	useEffect(() => {
		if (customExporters) {
			if (Array.isArray(customExporters)) {
				if (customExporters.length > 0) {
					const processedExporters = customExporters.filter(Boolean).map(processExporter);
					const hasMultiple = processedExporters.length > 1;

					setHasMultiple(hasMultiple);
					setExporters(hasMultiple ? processedExporters : processedExporters[0]);
				}
			} else {
				setExporters(processExporter(customExporters));
			}
		}
	}, [customExporters]);

	return {
		exporterDetails: exporters,
		hasMultipleExporters: hasMultiple,
	};
};
