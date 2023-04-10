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
	theme: { borderColor: customBorderColor, textOverflow: customTextOverflow } = emptyObj,
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
					letterSpacing: themeLetterSpacing,
					lineHeight: themeLineHeight,
					position: themePosition,
					selectedBackground: themeSelectedBackground = colors?.grey?.[300],
					textOverflow: themeTextOverflow,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Row' });

	const selected = props?.getIsSelected?.();
	const textOverflow = customTextOverflow || themeTextOverflow;
	const visibleCells = props?.getVisibleCells?.();
	const hasVisibleCells = visibleCells && visibleCells.length > 0;

	return (
		<tr
			className={cx('Row', themeClassName, { selected })}
			css={[
				css`
					background: ${themeBackground};
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
							theme={{
								columnWidth: `${cellObj.column.getSize()}px`,
							}}
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
