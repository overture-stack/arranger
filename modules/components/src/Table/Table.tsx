import { css } from '@emotion/react';
import cx from 'classnames';

import MetaMorphicChild from '@/MetaMorphicChild';
import Spinner from '@/Spinner';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { useTableData } from './helpers';
import TableHeaderRow from './HeaderRow';
import RewriteWarning from './RewriteWarning';
import TableRow from './Row';
import TableWrapper from './Wrapper';
import { TableProps } from './types';

const Table = ({
	className: customClassName,
	disableRowSelection = false,
	hideWarning = false,
	theme: { columnTypes, hideLoader: customHideLoader } = emptyObj,
}: TableProps) => {
	const { hasShowableColumns, hasVisibleColumns, isLoading, missingProvider, tableInstance } =
		useTableData({
			columnTypes,
			disableRowSelection,
		});
	const {
		colors,
		components: {
			Table: {
				// functionality
				hideLoader: themeHideLoader,
				noColumnsMessage = 'No columns to display.',

				// appearance
				background: themeTableBackground,
				borderColor: themeTableBorderColor = colors?.grey?.[200],
				css: themeTableCSS,
				fontColor: themeTableFontColor = colors?.grey?.[700],
				fontFamily: themeTableFontFamily,
				fontSize: themeTableFontSize = '0.8rem',
				fontWeight: themeTableFontWeight,
				letterSpacing: themeTableLetterSpacing,
				lineHeight: themeTableLineHeight,
				margin: themeTableMargin,
				padding: themeTablePadding = '0.1rem 0.4rem',
				textDecoration: themeTableTextDecoration,
				textOverflow: themeTableTextOverflow = 'ellipsis',
				textTransform: themeTableTextTransform,
				whiteSpace: themeTableWhiteSpace = 'nowrap',

				// Child Components
				HeaderGroup: {
					background: themeHeaderGroupBackground,
					borderColor: themeHeaderGroupBorderColor = themeTableBorderColor,
					className: themeHeaderGroupClassName,
					css: themeHeaderGroupCSS,
					margin: themeHeaderGroupMargin,
					overflow: themeHeaderGroupOverflow,
					position: themeHeaderGroupPosition,
				} = emptyObj,
				TableBody: {
					background: themeTableBodyBackground,
					borderColor: themeTableBodyBorderColor = themeTableBorderColor,
					className: themeTableBodyClassName,
					css: themeTableBodyCSS,
					margin: themeTableBodyMargin,
					overflow: themeTableBodyOverflow,
					position: themeTableBodyPosition,
				} = emptyObj,
				TableWrapper: {
					className: themeTableWrapperClassName,
					css: themeTableWrapperCSS,
					key: themeTableWrapperKey = 'ArrangerTableWrapper',
					...themeTableWrapperProps
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table' });

	const hideLoader = customHideLoader || themeHideLoader;
	const headerGroups = tableInstance.getHeaderGroups();
	const rows = tableInstance.getRowModel().rows;
	const hasVisibleRows = rows.length > 0;

	const containerStyles = css`
		background: ${themeTableBackground};
		border-collapse: collapse;
		color: ${themeTableFontColor};
		font-family: ${themeTableFontFamily};
		font-size: ${themeTableFontSize};
		font-weight: ${themeTableFontWeight};
		letter-spacing: ${themeTableLetterSpacing};
		line-height: ${themeTableLineHeight};
		table-layout: fixed;
		text-decoration: ${themeTableTextDecoration};
		text-transform: ${themeTableTextTransform};
		white-space: ${themeTableWhiteSpace};
		width: 100%;
	`;

	// temporary bypass for the warning if a provider is given
	// remove related code once the new Table is ready for primetime
	return hideWarning || !missingProvider ? (
		<TableWrapper
			className={cx('TableWrapper', customClassName, themeTableWrapperClassName)}
			css={themeTableWrapperCSS}
			key={themeTableWrapperKey}
			margin={themeTableMargin}
			{...themeTableWrapperProps}
		>
			{missingProvider ? (
				<div
					css={css`
						background: ${colors?.grey?.[200]};
						font-style: italic;
						padding: 0.7rem 0.5rem;
						width: 100%;
					`}
				>
					The table is missing its {missingProvider || 'context'} provider.
				</div>
			) : isLoading ? (
				hideLoader ? null : (
					<Spinner
						css={[
							css`
								border: 1px solid ${themeHeaderGroupBorderColor};
								padding: 1rem;
							`,
							containerStyles,
						]}
						theme={{ vertical: true }}
					>
						Loading table data...
					</Spinner>
				)
			) : hasShowableColumns ? (
				hasVisibleColumns ? (
					<table css={[containerStyles, themeTableCSS]}>
						<thead
							className={cx('TableHeaderGroup', themeHeaderGroupClassName)}
							css={[
								css`
									background: ${themeHeaderGroupBackground};
									border: ${themeHeaderGroupBorderColor &&
									`1px solid ${themeHeaderGroupBorderColor}`};
									margin: ${themeHeaderGroupMargin};
									overflow: ${themeHeaderGroupOverflow};
									position: ${themeHeaderGroupPosition};
								`,
								themeHeaderGroupCSS,
							]}
						>
							{headerGroups.map((headerGroup) => (
								<TableHeaderRow
									hasVisibleRows={hasVisibleRows}
									key={headerGroup.id}
									padding={themeTablePadding}
									textOverflow={themeTableTextOverflow}
									{...headerGroup}
								/>
							))}
						</thead>

						<tbody
							className={cx('TableBody', themeTableBodyClassName)}
							css={[
								css`
									background: ${themeTableBodyBackground};
									border: ${themeTableBodyBorderColor && `1px solid ${themeTableBodyBorderColor}`};
									margin: ${themeTableBodyMargin};
									overflow: ${themeTableBodyOverflow};
									position: ${themeTableBodyPosition};
								`,
								themeTableBodyCSS,
							]}
						>
							{hasVisibleRows ? (
								rows.map((row) => (
									<TableRow
										key={row.id}
										theme={{
											padding: themeTablePadding,
											textOverflow: themeTableTextOverflow,
										}}
										{...row}
									/>
								))
							) : (
								// Reuse Row + Cell to display "no data" message
								<TableRow />
							)}
						</tbody>
					</table>
				) : (
					<MetaMorphicChild>{noColumnsMessage}</MetaMorphicChild>
				)
			) : (
				'Something went wrong with the request. Please try again after refreshing the browser.'
			)}
		</TableWrapper>
	) : (
		<RewriteWarning />
	);
};

export default Table;
