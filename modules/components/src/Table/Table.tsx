import { PropsWithChildren, useLayoutEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import MetaMorphicChild from '@/MetaMorphicChild';
import Spinner from '@/Spinner';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { useTableData } from './helpers';
import HeaderRow from './HeaderRow';
import Row from './Row';
import TableWrapper from './Wrapper';
import { TableProps } from './types';

const Table = ({
	className: customClassName,
	disableRowSelection = false,
	theme: { columnTypes, hideLoader: customHideLoader } = emptyObj,
}: TableProps) => {
	const ref = useRef<HTMLElement>(null);
	const [visibleTableWidth, setVisibleTableWidth] = useState(0);
	const { hasShowableColumns, hasVisibleColumns, isLoading, missingProvider, tableInstance } =
		useTableData({
			columnTypes,
			disableRowSelection,
			visibleTableWidth,
		});
	const {
		colors,
		components: {
			Table: {
				// functionality
				errorMessage = 'The table failed to load. Please try again later.',
				hideLoader: themeHideLoader,
				loadingMessage = 'Loading table data...',
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
				textDecoration: themeTableTextDecoration,
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

		* {
			box-sizing: border-box;
		}
	`;

	const MessageContainer = ({ Component = 'figure', children }: PropsWithChildren<any>) => (
		<Component
			css={[
				css`
					background: ${colors?.grey?.[200]};
					border: 1px solid ${themeHeaderGroupBorderColor};
					display: flex;
					font-style: italic;
					justify-content: center;
					margin: 0;
					padding: 0.7rem 0.5rem;
				`,
				containerStyles,
			]}
		>
			<MetaMorphicChild>{children}</MetaMorphicChild>
		</Component>
	);

	useLayoutEffect(() => {
		const { width } = ref?.current?.getBoundingClientRect?.() || { width: 0 };
		setVisibleTableWidth(width);
	}, []);

	return (
		<TableWrapper
			className={cx('TableWrapper', customClassName, themeTableWrapperClassName)}
			css={themeTableWrapperCSS}
			key={themeTableWrapperKey}
			margin={themeTableMargin}
			ref={ref}
			{...themeTableWrapperProps}
		>
			{missingProvider ? (
				<MessageContainer>
					This table is missing its {missingProvider || 'context'} provider.
				</MessageContainer>
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
						{loadingMessage}
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
								<HeaderRow hasVisibleRows={hasVisibleRows} key={headerGroup.id} {...headerGroup} />
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
								rows.map((row) => <Row key={row.id} {...row} />)
							) : (
								// Reuse Row + Cell to display "no data" message
								<Row />
							)}
						</tbody>
					</table>
				) : (
					<MessageContainer>{noColumnsMessage}</MessageContainer>
				)
			) : (
				<MessageContainer>{errorMessage}</MessageContainer>
			)}
		</TableWrapper>
	);
};

export default Table;
