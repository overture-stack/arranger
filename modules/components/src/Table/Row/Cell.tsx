import { css } from '@emotion/react';
import cx from 'classnames';

import { ColumnListStyles } from '@/Table/types';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { CellProps } from './types';

const Cell = ({
	accessor = '',
	children,
	colSpan,
	css: customCss,
	theme: {
		columnWidth: themeTableColumnWidth,
		hoverVerticalBorderColor: customHoverVerticalBorderColor,
		padding: customPadding,
		textOverflow: customTextOverflow,
		verticalBorderColor: customVerticalBorderColor,
	} = emptyObj,
	value,
}: CellProps) => {
	const {
		components: {
			Table: {
				padding: themeTablePadding = '0.1rem 0.4rem',
				textOverflow: themeTableTextOverflow = 'ellipsis',

				// components
				columnTypes: {
					list: { listStyle: themeListStyle } = emptyObj,
					...otherThemeColumnTypes
				} = emptyObj,
				Cell: { css: themeCss } = emptyObj,
				Row: {
					borderColor: themeBorderColor,
					hoverVerticalBorderColor: themeHoverVerticalBorderColor,
					overflow: themeOverflow = 'hidden',
					padding: themePadding = themeTablePadding,
					textDecoration: themeTextDecoration,
					textOverflow: themeTextOverflow = themeTableTextOverflow,
					textTransform: themeTextTransform,
					verticalBorderColor: themeVerticalBorderColor = themeBorderColor,
					whiteSpace: themeWhiteSpace,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Row' });

	const hoverVerticalBorderColor = customHoverVerticalBorderColor || themeHoverVerticalBorderColor;
	const padding = customPadding || themePadding;
	const textOverflow = customTextOverflow || themeTextOverflow;
	const verticalBorderColor = customVerticalBorderColor || themeVerticalBorderColor;

	const { listStyle = themeListStyle } = otherThemeColumnTypes[accessor] || emptyObj;

	return (
		<td
			className={cx('cell')}
			colSpan={colSpan}
			css={[
				css`
					overflow: ${themeOverflow};
					padding: ${padding};
					text-align: left;
					text-decoration: ${themeTextDecoration};
					text-overflow: ${textOverflow};
					text-transform: ${themeTextTransform};
					vertical-align: top;
					white-space: ${themeWhiteSpace};
					width: ${themeTableColumnWidth};

					&:not(:last-of-type) {
						border-right: ${verticalBorderColor && `1px solid ${verticalBorderColor}`};

						&:hover {
							border-right: ${hoverVerticalBorderColor && `1px solid ${hoverVerticalBorderColor}`};
						}
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
				themeCss,
				customCss,
			]}
			data-accessor={accessor}
			data-value={value}
			title={value}
		>
			{children}
		</td>
	);
};

export default Cell;
