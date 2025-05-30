import { css } from '@emotion/react';
import SQONBuilder from '@overture-stack/sqon-builder';
import cx from 'classnames';
import { merge } from 'lodash-es';
import urlJoin from 'url-join';

import { TransparentButton } from '#Button/index.js';
import { useDataContext } from '#DataContext/index.js';
import MultiSelectDropDown from '#DropDown/MultiSelectDropDown.js';
import MetaMorphicChild from '#MetaMorphicChild/index.js';
import { useTableContext } from '#Table/helpers/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import { ARRANGER_API } from '#utils/config.js';
import download from '#utils/download.js';
import noopFn, { emptyObj } from '#utils/noops.js';
import stringCleaner from '#utils/stringCleaner.js';

import { useExporters } from './helpers.js';
import SingleDownloadButton from './SingleDownload.js';
import type { DownloadButtonProps, ProcessedExporterDetailsInterface } from './types.js';

/**
 * This component allows library integrators to pass custom exporters (functionality to be run on the data, e.g. get JSON)
 * They can provide their own function (default is `saveTSV`) through `theme.customExporters`, as well as other props to
 * customise the resulting button; or they can display multiple options in a dropdown, by passing an array of objects.
 *
 * Either case must follow the following pattern (all params are optional):
 *
 *   @param {string[] | { fieldName }} columns
 *   Columns passed here override the ones currently being displayed in the table.
 *   the format for these is always an array, which could consist of one of the following types:
 *   accessor strings, or objects with a "fieldName" and any other properties as functions or their desired values.
 *   If columns is missing or `null`, the exporter will use all columns shown in the table.
 *   Bonus: if an empty array is given, the exporter will use every (showable) column declared in the config.
 *   @param {ExporterFn} exporterFn
 *   Allows for you to use your own middleware to handle the data. This attribute accepts 'saveTSV' to use the default functionality.
 *   @param {string} fileName
 *   The desired file name for your export.
 *   When a fileName is given without a custom function, Arranger will produce a `.TSV` file.
 *   @param {string | ReactNode} label
 *   A label doesn't require an exporter function, and can be a React component (e.g. to display instructions, a divider, etc.)
 *   Furthermore, if `label` is 'saveTSV', Arranger will use its internal TSV exporter.
 *   @param {number} maxRows
 *   Limit number of rows to include in the export.
 *   @param {boolean} requiresRowSelection
 *   Disables the exporter in the abscence of row selections.
 */
const DownloadButton = ({
	className: customClassName,
	theme: {
		customExporters,
		disableRowSelection: customDisableRowSelection,
		downloadUrl: customDownloadUrl,
		label: customLabel,
		maxRows: customMaxRows,
		...customThemeProps
	} = emptyObj,
}: DownloadButtonProps) => {
	const { apiUrl = ARRANGER_API } = useDataContext();

	const {
		allColumnsDict,
		currentColumnsDict,
		documentType,
		hasSelectedRows,
		hasVisibleColumns,
		isLoading,
		missingProvider,
		selectedRows,
		sqon,
		total,
	} = useTableContext({
		callerName: 'Table - ColumnSelectButton',
	});

	const {
		components: {
			Table: {
				DownloadButton: {
					className: themeClassName,
					customExporters: themeCustomExporters,
					disableRowSelection: themeDisableRowSelection,
					downloadUrl: themeDownloadUrl = urlJoin(apiUrl, 'download'),
					label: themeDownloadButtonLabel = 'Download',
					maxRows: themeMaxRows = 100,
					exportSelectedRowsField = 'file_autocomplete',
					...themeDownloadButtonProps
				} = emptyObj,
				DropDown: { label: themeDropDownLabel, ...themeDropDownProps } = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - ColumnSelectButton' });

	const disableButton = isLoading || !!missingProvider || !hasVisibleColumns || !total;
	const disableRowSelection = customDisableRowSelection || themeDisableRowSelection;
	const downloadUrl = customDownloadUrl || themeDownloadUrl;
	const exporters = customExporters || themeCustomExporters;
	const Label = customLabel || themeDownloadButtonLabel || themeDropDownLabel;
	const maxRows = customMaxRows || themeMaxRows;
	const theme = merge({}, themeDropDownProps, themeDownloadButtonProps, customThemeProps);

	const { exporterDetails, hasMultipleExporters } = useExporters(exporters);

	const downloadSqon =
		!disableRowSelection && hasSelectedRows
			? SQONBuilder.in(exportSelectedRowsField, selectedRows).toValue()
			: sqon;

	const handleExporterClick = (
		{
			exporterColumns,
			exporterDownloadUrl = downloadUrl,
			exporterFileName,
			exporterFunction,
			exporterLabel,
			exporterMaxRows = maxRows,
			exporterRequiresRowSelection,
			exporterValueWhenEmpty: valueWhenEmpty,
		}: ProcessedExporterDetailsInterface,
		closeDropDownFn = noopFn,
	) =>
		(exporterFunction && exporterRequiresRowSelection && !hasSelectedRows) || !exporterFunction
			? undefined
			: () => {
					closeDropDownFn();
					return exporterFunction?.(
						{
							files: [
								{
									allColumnsDict,
									columns: Object.values(currentColumnsDict),
									documentType,
									exporterColumns,
									fileName: exporterFileName
										? `${exporterFileName}${exporterFileName.toLowerCase().endsWith('.tsv') ? '' : '.tsv'}`
										: `${stringCleaner((exporterLabel as string).toLowerCase())}.tsv`,
									fileType: 'tsv',
									maxRows: exporterMaxRows,
									sqon: downloadSqon,
									valueWhenEmpty,
								},
							],
							selectedRows,
							sqon: downloadSqon,
							url: exporterDownloadUrl,
						},
						download,
					);
				};

	// check if we're given more than one custom exporter
	return hasMultipleExporters ? (
		<MultiSelectDropDown
			buttonAriaLabelClosed="Open downloads menu"
			buttonAriaLabelOpen="Close downloads menu"
			className={cx('DownloadButton', customClassName, themeClassName)}
			disabled={disableButton}
			itemSelectionLegend="Select on of the download options"
			items={exporterDetails as ProcessedExporterDetailsInterface[]}
			itemToString={(exporter: ProcessedExporterDetailsInterface, closeDropDownFn = noopFn) => {
				return (
					<TransparentButton
						css={css`
							width: 100%;
						`}
						onClick={handleExporterClick(exporter, closeDropDownFn)}
					>
						<MetaMorphicChild>{exporter.exporterLabel || 'unlabeled exporter'}</MetaMorphicChild>
					</TransparentButton>
				);
			}}
			theme={theme}
		>
			<MetaMorphicChild>{Label}</MetaMorphicChild>
		</MultiSelectDropDown>
	) : (
		// else, use a custom function if any is given, or use the default saveTSV if the flag is on
		<SingleDownloadButton
			className={cx('DownloadButton', customClassName, themeClassName)}
			clickHandler={handleExporterClick(exporterDetails as ProcessedExporterDetailsInterface)}
			disabled={isLoading || !!missingProvider}
			theme={theme}
			{...exporterDetails}
		/>
	);
};

export default DownloadButton;
