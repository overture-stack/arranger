import cx from 'classnames';
import { merge } from 'lodash-es';
import { type ChangeEvent, useCallback, useEffect, useState } from 'react';

import type { ColumnMappingInterface } from '#DataContext/types.js';
import MultiSelectDropDown from '#DropDown/MultiSelectDropDown.js';
import MetaMorphicChild from '#MetaMorphicChild/index.js';
import { columnsArrayToDictionary, getColumnsByAttribute, useTableContext } from '#Table/helpers/index.js';
import type { ColumnsDictionary } from '#Table/types.js';
import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import type { ColumnSelectButtonProps } from './types.js';

const getShowableColumns = (columnsDict = emptyObj as ColumnsDictionary) =>
	getColumnsByAttribute(Object.values(columnsDict), 'canChangeShow');

/**
 * This component can only access the columns that allow changing their visibility
 */
const ColumnsSelectButton = ({
	className: customClassName,
	theme: { label: customLabel, ...customThemeProps } = emptyObj,
}: ColumnSelectButtonProps) => {
	const [showableColumns, setShowableColumns] = useState<ColumnMappingInterface[]>([]);
	const {
		allColumnsDict,
		currentColumnsDict,
		hasShowableColumns,
		isLoading,
		missingProvider,
		setCurrentColumnsDict,
		total,
	} = useTableContext({
		callerName: 'Table - ColumnSelectButton',
	});
	const {
		components: {
			Table: {
				ColumnSelectButton: {
					className: themeClassName,
					label: themeColumnSelectButtonLabel = 'Columns',
					...themeColumnSelectButtonProps
				} = emptyObj,
				DropDown: { label: themeTableDropDownLabel, ...themeTableDropDownProps } = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - ColumnSelectButton' });

	const handleSelectionChanges = useCallback(
		(
			event: ChangeEvent<HTMLInputElement>,
			change: 'all' | 'one' | 'reset',
			value: ColumnMappingInterface | boolean = false,
		) => {
			switch (change) {
				case 'all': {
					const show = value as boolean;

					return setCurrentColumnsDict(
						columnsArrayToDictionary(
							Object.values(currentColumnsDict).map((column) =>
								column.canChangeShow
									? {
											...column,
											show,
										}
									: column,
							),
						),
					);
				}

				case 'one': {
					const column = value as ColumnMappingInterface;

					return setCurrentColumnsDict({
						...currentColumnsDict,
						[column.fieldName]: {
							...column,
							show: !column.show,
						},
					});
				}

				case 'reset': {
					return setCurrentColumnsDict(allColumnsDict);
				}
			}
		},
		[allColumnsDict, currentColumnsDict, setCurrentColumnsDict],
	);
	const disableButton = !total || (!hasShowableColumns && (isLoading || !!missingProvider));
	const Label = customLabel || themeColumnSelectButtonLabel || themeTableDropDownLabel;
	const multiSelectDropDownProps = merge(
		{
			enableFilter: true,
			filterPlaceholder: 'Search',
		},
		themeTableDropDownProps,
		themeColumnSelectButtonProps,
		customThemeProps,
	);

	useEffect(() => {
		setShowableColumns(getShowableColumns(currentColumnsDict));
	}, [currentColumnsDict]);

	return (
		<MultiSelectDropDown
			allowControls
			allowSelection
			buttonAriaLabelClosed="Open column selection menu"
			buttonAriaLabelOpen="Close column selection menu"
			className={cx('ColumnSelectButton', customClassName, themeClassName)}
			disabled={disableButton}
			itemSelectionLegend="Select columns to display"
			items={showableColumns}
			itemToString={(column: ColumnMappingInterface) => column.displayName}
			onChange={handleSelectionChanges}
			resetToDefaultAriaLabel="Reset to default columns"
			selectAllAriaLabel="Select all columns"
			theme={multiSelectDropDownProps}
		>
			<MetaMorphicChild>{Label}</MetaMorphicChild>
		</MultiSelectDropDown>
	);
};

export default ColumnsSelectButton;
