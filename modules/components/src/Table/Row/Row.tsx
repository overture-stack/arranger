import { css } from '@emotion/react';
import { flexRender } from '@tanstack/react-table';
import cx from 'classnames';

import { getDisplayValue } from '@/Table/helpers';
import { SELECTION_COLUMN_ID } from '@/Table/types';
import MetaMorphicChild from '@/MetaMorphicChild';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import Cell from './Cell';
import { RowProps } from './types';

const TableRow = ({
	css: customCSS,
	id,
	theme: {
		borderColor: customBorderColor,
		hoverBackground: customHoverBackground,
		hoverHorizontalBorderColor: customHoverHorizontalBorderColor,
		hoverVerticalBorderColor: customHoverVerticalBorderColor,
		textOverflow: customTextOverflow,
	} = emptyObj,
	...props
}: RowProps) => {
	const {
		colors,
		components: {
			Table: {
				noDataMessage = 'No data matches the search parameters.',

				// components
				Row: {
					background: themeBackground,
					borderColor: themeBorderColor = customBorderColor,
					className: themeClassName,
					css: themeCSS,
					fontColor: themeFontColor,
					fontFamily: themeFontFamily,
					fontSize: themeFontSize,
					fontWeight: themeFontWeight,
					horizontalBorderColor: themeHorizontalBorderColor = themeBorderColor,
					hoverBackground: themeHoverBackground = colors?.grey?.[100],
					hoverBorderColor: themeHoverBorderColor,
					hoverFontColor: themeHoverFontColor,
					hoverHorizontalBorderColor: themeHoverHorizontalBorderColor,
					hoverVerticalBorderColor: themeHoverVerticalBorderColor,
					letterSpacing: themeLetterSpacing,
					lineHeight: themeLineHeight,
					position: themePosition,
					selectedBackground: themeSelectedBackground = colors?.grey?.[300],
					textOverflow: themeTextOverflow,
					verticalBorderColor: themeVerticalBorderColor = themeBorderColor,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Row' });

	const selected = props?.getIsSelected?.();
	const textOverflow = customTextOverflow || themeTextOverflow;
	const visibleCells = props?.getVisibleCells?.();
	const hasVisibleCells = visibleCells && visibleCells.length > 0;

	const hoverBackground = customHoverBackground || themeHoverBackground;
	const hoverHorizontalBorderColor =
		customHoverHorizontalBorderColor || themeHoverHorizontalBorderColor || themeHoverBorderColor;
	const hoverVerticalBorderColor =
		customHoverVerticalBorderColor || themeHoverVerticalBorderColor || themeHoverBorderColor;

	return (
		<tr
			className={cx('Row', themeClassName, { selected })}
			css={[
				css`
					background: ${themeBackground};
					border-left: ${themeVerticalBorderColor && `0.1rem solid ${themeVerticalBorderColor}`};
					border-right: ${themeVerticalBorderColor && `0.1rem solid ${themeVerticalBorderColor}`};
					color: ${themeFontColor};
					font-family: ${themeFontFamily};
					font-size: ${themeFontSize};
					font-weight: ${themeFontWeight};
					letter-spacing: ${themeLetterSpacing};
					line-height: ${themeLineHeight};
					position: ${themePosition};
					text-overflow: ${textOverflow};

					&:first-of-type {
						padding-top: 0.2rem;
					}

					&:not(:last-of-type) {
						border-bottom: ${themeHorizontalBorderColor &&
						`0.1rem solid ${themeHorizontalBorderColor}`};
					}

					&.selected {
						background-color: ${themeSelectedBackground} !important;

						&:hover: {
							// TODO: extend styles for this
						}
					}

					&:hover {
						background: ${hoverBackground} !important;
						border-bottom: ${hoverHorizontalBorderColor &&
						`1px solid ${hoverHorizontalBorderColor}`};
						border-left: ${hoverVerticalBorderColor && `1px solid ${hoverVerticalBorderColor}`};
						border-right: ${hoverVerticalBorderColor && `1px solid ${hoverVerticalBorderColor}`};
						border-top: ${hoverHorizontalBorderColor && `1px solid ${hoverHorizontalBorderColor}`};
						color: ${themeHoverFontColor};
						z-index: 666;
					}

					&[data-row-id]:hover {
						background: ${themeHoverBackground};
					}
				`,
				themeCSS,
				customCSS,
			]}
			data-row-id={id}
		>
			{hasVisibleCells ? (
				visibleCells?.map((cellObj) => {
					const accessor = cellObj.column.id;
					const value =
						accessor === SELECTION_COLUMN_ID
							? `${selected}`
							: getDisplayValue(cellObj?.row?.original, cellObj.column.columnDef);

					return (
						<Cell
							accessor={accessor}
							key={cellObj.id}
							size={`${cellObj.column.getSize()}px`}
							value={value}
						>
							{flexRender(cellObj.column.columnDef.cell, cellObj.getContext())}
						</Cell>
					);
				})
			) : (
				<Cell colSpan={100}>
					<MetaMorphicChild>{noDataMessage}</MetaMorphicChild>
				</Cell>
			)}
		</tr>
	);
};

export default TableRow;
