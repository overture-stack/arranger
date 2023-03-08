import { css } from '@emotion/react';
import { flexRender, HeaderGroup } from '@tanstack/react-table';
import cx from 'classnames';

import { TransparentButton } from '@/Button';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { useTableContext } from './helpers';

const TableHeaderRow = ({
	hasVisibleRows,
	headers,
	theme: {
		padding: customPadding,
		sortingHighlightColor: customSortingHighlightColor,
		textOverflow: themeTableTextOverflow,
	} = emptyObj,
}: {
	hasVisibleRows?: boolean;
	theme?: {
		padding?: string;
		textOverflow?: string;
		sortingHighlightColor?: string;
	};
} & HeaderGroup<any>) => {
	const { allColumnsDict } = useTableContext({ callerName: 'TableHeaderrow' });
	const {
		colors,
		components: {
			Table: {
				HeaderRow: {
					background: themeBackground,
					borderColor: themeBorderColor,
					className: themeClassName,
					css: themeCSS,
					disabledBackground: themeDisabledBackground = colors?.grey?.[100],
					disabledFontColor: themeDisabledFontColor = colors?.grey?.[500],
					fontColor: themeFontColor = colors?.grey?.[800],
					fontFamily: themeFontFamily,
					fontSize: themeFontSize = '0.9rem',
					fontWeight: themeFontWeight,
					horizontalBorderColor: themeBorderColor_horizontal,
					letterSpacing: themeLetterSpacing,
					lineHeight: themeLineHeight,
					overflow: themeOverflow = 'hidden',
					padding: themePadding = '0.2rem 0.4rem',
					position: themePosition,
					sortingHighlightColor: themeSortingHighlightColor = colors?.grey?.[500],
					textDecoration: themeTextDecoration,
					textOverflow: themeTextOverflow = themeTableTextOverflow,
					textTransform: themeTextTransform,
					verticalalBorderColor: themeBorderColor_vertical,
					whiteSpace: themeWhiteSpace,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'TableHeaderRow' });

	const headerHighlightColor = customSortingHighlightColor || themeSortingHighlightColor;
	const headerPadding = customPadding || themePadding;
	const borderColor_horizontal = themeBorderColor_horizontal || themeBorderColor;
	const borderColor_vertical = themeBorderColor_vertical || themeBorderColor;

	return (
		<tr
			className={cx('TableHeaderRow', themeClassName)}
			css={[
				themeCSS,
				css`
					background: ${hasVisibleRows ? themeBackground : themeDisabledBackground};
					color: ${hasVisibleRows ? themeFontColor : themeDisabledFontColor};
					font-family: ${themeFontFamily};
					font-size: ${themeFontSize};
					font-weight: ${themeFontWeight};
					letter-spacing: ${themeLetterSpacing};
					line-height: ${themeLineHeight};
					position: ${themePosition};

					&:not(:last-of-type) {
						border-bottom: ${borderColor_horizontal && `0.1rem solid ${borderColor_horizontal}`};
					}
				`,
			]}
		>
			{headers.map((headerObj) => {
				const { displayName, sortable } = allColumnsDict[headerObj.id] || {
					displayName: '',
					sortable: false,
				};

				const isSorted = headerObj.column.getIsSorted();

				return (
					<th
						className={cx('table_header', headerObj.id, {
							asc: isSorted === 'asc',
							desc: isSorted === 'desc',
							sortable,
						})}
						css={css`
							overflow: ${themeOverflow};
							padding: ${headerPadding};
							position: relative;
							text-align: left;
							text-decoration: ${themeTextDecoration};
							text-overflow: ${themeTextOverflow};
							text-transform: ${themeTextTransform};
							white-space: ${themeWhiteSpace};
							/* left: header.getStart(), */
							width: ${headerObj.getSize()}px;

							&:not(:last-of-type) {
								border-right: ${borderColor_vertical && `1px solid ${borderColor_vertical}`};
							}

							&.sortable {
								cursor: pointer;

								&.asc {
									box-shadow: inset 0 3px 0 0 ${headerHighlightColor};
								}

								&.desc {
									box-shadow: inset 0 -3px 0 0 ${headerHighlightColor};
								}
							}
						`}
						data-accessor={headerObj.id}
						data-header={displayName}
						key={headerObj.id}
						onClick={headerObj.column.getToggleSortingHandler()}
						title={displayName}
					>
						{headerObj.isPlaceholder
							? null
							: flexRender(headerObj.column.columnDef.header, headerObj.getContext())}

						{headerObj.column.getCanResize() && (
							<TransparentButton
								className={`resizer ${headerObj.column.getIsResizing() ? 'isResizing' : ''}`}
								css={css`
									background: rgba(0, 0, 0, 0.5);
									cursor: col-resize;
									height: 100%;
									position: absolute;
									right: 0;
									top: 0;
									touch-action: none;
									user-select: none;
									width: 3px;

									&.isResizing {
										background: blue;
										opacity: 1;
									}

									@media (hover: hover) {
										opacity: 0;

										&:hover {
											opacity: 1;
										}
									}
								`}
								onMouseDown={headerObj.getResizeHandler()}
								onTouchStart={headerObj.getResizeHandler()}
							/>
						)}
					</th>
				);
			})}
		</tr>
	);
};

export default TableHeaderRow;
