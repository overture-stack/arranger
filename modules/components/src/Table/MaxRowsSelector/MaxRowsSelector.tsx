import { ChangeEventHandler } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import { useTableContext } from '@/Table/helpers';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { MaxRowsSelectorProps } from './types';

const MaxRowsSelector = ({
	className: customClassName,
	css: customCSS,
	disabled: customDisabled,
	theme: {
		borderColor: customBorderColor,
		borderRadius: customBorderRadius,
		fontColor: customFontColor,
		fontSize: customFontSize,
		pageSizes: customPageSizes,
	} = emptyObj,
}: MaxRowsSelectorProps) => {
	const { pageSize, setPageSize } = useTableContext({
		callerName: 'Table - MaxRowsSelector',
	});

	const {
		colors,
		components: {
			Table: {
				MaxRowsSelector: {
					borderColor: themeBorderColor = colors?.grey?.[300],
					borderRadius: themeBorderRadius = '0.3rem',
					className: themeClassName,
					css: themeCSS,
					disabled: themeDisabled,
					fontColor: themeFontColor = colors?.grey?.[700],
					fontSize: themeFontSize = '0.8rem',
					pageSizes: themePageSizes = [5, 10, 20, 25, 50, 100],
					// pageSizes: themePageSizes = [5, 10, 20, 25, 50, 100, 500, 1000, 5000, 10000], // For testing purposes
					/* disabledFill: themeDisabledFill = colors?.grey?.[400],
          fill: themeFill = colors?.grey?.[600], */
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - MaxRowsSelector' });

	const changeHandler: ChangeEventHandler<HTMLSelectElement> = (event) => {
		setPageSize(Number(event.target.value));
	};
	const className = cx('MaxRowsSelector', customClassName, themeClassName);

	return (
		<article
			className={className}
			css={[
				css`
					color: ${customFontColor || themeFontColor};
					font-size: ${customFontSize || themeFontSize};
				`,
				themeCSS,
				customCSS,
			]}
		>
			<span>Show </span>

			<select
				css={css`
					border: 0.1rem solid ${customBorderColor || themeBorderColor};
					border-radius: ${customBorderRadius || themeBorderRadius};
					color: ${customFontColor || themeFontColor};
					font-size: calc(${customFontSize || themeFontSize} * 0.9);
					margin: 0.1rem;
					padding: 0.1rem 0;
					text-align: center;
				`}
				disabled={customDisabled || themeDisabled}
				onChange={changeHandler}
				value={pageSize}
			>
				{(customPageSizes || themePageSizes).map((pageSize: number) => (
					<option key={pageSize} value={pageSize}>
						{pageSize}
					</option>
				))}
			</select>

			<span> rows</span>
		</article>
	);
};

export default MaxRowsSelector;
