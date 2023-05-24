import { css } from '@emotion/react';
import cx from 'classnames';

import { ColumnListStyles, SELECTION_COLUMN_ID } from '@/Table/types';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { CellProps } from './types';

const Cell = ({
	accessor = '',
	children,
	colSpan,
	css: customCSS,
	size: columnWidth,
	theme: {
		background: customBackground,
		borderColor: customBorderColor,
		horizontalBorderColor: customHorizontalBorderColor,
		hoverBackground: customHoverBackground,
		hoverHorizontalBorderColor: customHoverHorizontalBorderColor,
		hoverVerticalBorderColor: customHoverVerticalBorderColor,
		padding: customPadding,
		textOverflow: customTextOverflow,
		verticalBorderColor: customVerticalBorderColor,
	} = emptyObj,
	value,
}: CellProps) => {
	const {
		colors,
		components: {
			Table: {
				padding: themeTablePadding = '0.1rem 0.4rem',
				textOverflow: themeTableTextOverflow = 'ellipsis',

				// components
				columnTypes: {
					list: { listStyle: themeListStyle } = emptyObj,
					...otherThemeColumnTypes
				} = emptyObj,
				Cell: {
					background: themeBackground,
					borderColor: themeBorderColor = 'transparent',
					className: themeClassName,
					css: themeCSS,
					fontColor: themeFontColor,
					horizontalBorderColor: themeHorizontalBorderColor,
					hoverBackground: themeHoverBackground = colors?.grey?.[300],
					hoverBorderColor: themeHoverBorderColor,
					hoverFontColor: themeHoverFontColor,
					hoverHorizontalBorderColor: themeHoverHorizontalBorderColor,
					hoverVerticalBorderColor: themeHoverVerticalBorderColor,
					overflow: themeOverflow = 'hidden',
					padding: themePadding = themeTablePadding,
					textDecoration: themeTextDecoration,
					textOverflow: themeTextOverflow = themeTableTextOverflow,
					textTransform: themeTextTransform,
					verticalBorderColor: themeVerticalBorderColor,
					whiteSpace: themeWhiteSpace,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Cell' });

	const background = customBackground || themeBackground;
	const horizontalBorderColor =
		customHorizontalBorderColor ||
		themeHorizontalBorderColor ||
		customBorderColor ||
		themeBorderColor;
	const verticalBorderColor =
		customVerticalBorderColor || themeVerticalBorderColor || customBorderColor || themeBorderColor;
	const hoverBackground = customHoverBackground || themeHoverBackground;
	const hoverHorizontalBorderColor =
		customHoverHorizontalBorderColor || themeHoverHorizontalBorderColor || themeHoverBorderColor;
	const hoverVerticalBorderColor =
		customHoverVerticalBorderColor || themeHoverVerticalBorderColor || themeHoverBorderColor;
	const padding = customPadding || themePadding;
	const textOverflow = customTextOverflow || themeTextOverflow;

	const { listStyle = themeListStyle } = otherThemeColumnTypes[accessor] || emptyObj;

	return (
		<td
			className={cx('cell', themeClassName)}
			colSpan={colSpan}
			css={[
				css`
					background: ${background};
					border-bottom-color: ${horizontalBorderColor};
					border-left-color: ${verticalBorderColor};
					border-right-color: ${verticalBorderColor};
					border-top-color: ${horizontalBorderColor};
					border-style: solid;
					border-width: 1px;
					box-sizing: border-box;
					color: ${themeFontColor};
					overflow: ${themeOverflow};
					padding: ${padding};
					position: relative;
					text-align: left;
					text-decoration: ${themeTextDecoration};
					text-overflow: ${textOverflow};
					text-transform: ${themeTextTransform};
					vertical-align: top;
					white-space: ${themeWhiteSpace};
					width: ${columnWidth};

					&:hover {
						background: ${hoverBackground};
						border-bottom-color: ${hoverHorizontalBorderColor};
						border-left-color: ${hoverVerticalBorderColor};
						border-right-color: ${hoverVerticalBorderColor};
						border-top-color: ${hoverHorizontalBorderColor};
						color: ${themeHoverFontColor};
						z-index: 666;
					}

					ul.list-values {
						margin: 0;
						padding: 0;

						> li {
							line-height: 1rem;
							list-style-position: inside;
							overflow: hidden;
							text-overflow: ellipsis;
						}

						&.none {
							list-style: none;
							padding: 0;
						}

						&.commas {
							display: flex;
							flex-wrap: wrap;
							list-style: none;
							padding: 0;

							> li:not(:last-of-type)::after {
								content: ', ';
								margin-right: 0.2rem;
							}
						}

						&.letters {
							list-style: lower-alpha;
						}

						&.numbers {
							list-style: decimal;
						}

						&.roman {
							list-style: upper-roman;
						}

						${listStyle &&
						!Object.values(ColumnListStyles).includes(listStyle) &&
						css`
							list-style: ${listStyle};
							padding-left: ${listStyle === 'none' && 0};
						`}
					}
				`,
				themeCSS,
				customCSS,
			]}
			data-accessor={accessor}
			data-value={value}
			title={accessor === SELECTION_COLUMN_ID ? 'Select this row' : value}
		>
			{children}
		</td>
	);
};

export default Cell;
