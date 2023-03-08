import { PropsWithChildren } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { ColumnListStyles, ColumnTypesObject, FieldList } from './types';

const Cell = ({
	accessor = '',
	children,
	colSpan,
	theme: {
		columnWidth: themeTableColumnWidth,
		padding: themeTablePadding,
		textOverflow: themeTableTextOverflow,
	} = emptyObj,
	value,
}: PropsWithChildren<{
	accessor?: FieldList[number];
	colSpan?: number;
	theme?: {
		columnWidth?: string;
		padding?: string;
		textOverflow?: string;
	};
	value?: string;
}>) => {
	const {
		components: {
			Table: {
				columnTypes: {
					list: { listStyle: themeListStyle } = emptyObj,
					...otherThemeColumnTypes
				} = emptyObj as ColumnTypesObject,
				Row: {
					borderColor: themeBorderColor,
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
	} = useThemeContext({ callerName: 'Table - Row' });
	const verticalBorderColor = themeVerticalBorderColor || themeBorderColor;

	const { listStyle = themeListStyle } = otherThemeColumnTypes[accessor] || emptyObj;

	return (
		<td
			className={cx('cell')}
			colSpan={colSpan}
			css={css`
				overflow: ${themeOverflow};
				padding: ${themePadding};
				text-align: left;
				text-decoration: ${themeTextDecoration};
				text-overflow: ${themeTextOverflow};
				text-transform: ${themeTextTransform};
				vertical-align: top;
				white-space: ${themeWhiteSpace};
				width: ${themeTableColumnWidth};

				&:not(:last-of-type) {
					border-right: ${verticalBorderColor && `1px solid ${verticalBorderColor}`};
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
			`}
			data-accessor={accessor}
			data-value={value}
			title={value}
		>
			{children}
		</td>
	);
};

export default Cell;
