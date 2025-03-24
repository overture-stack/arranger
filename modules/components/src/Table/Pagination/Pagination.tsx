import { css } from '@emotion/react';
import cx from 'classnames';
import { merge } from 'lodash-es';
import { useMemo } from 'react';

import MaxRowsSelector from '#Table/MaxRowsSelector/index.js';
import PageSelector from '#Table/PageSelector/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import type { PaginationProps } from './types.js';

const Pagination = ({
	className: customClassName,
	css: customCSS,
	theme: { MaxRowSelector: customMaxRowSelectorProps, PageSelector: customPageSelectorProps } = emptyObj,
}: PaginationProps) => {
	const {
		components: {
			Table: {
				Pagination: {
					className: themeClassName,
					css: themeCSS,
					MaxRowsSelector: themeMaxRowsSelectorProps = emptyObj,
					PageSelector: themePageSelectorProps = emptyObj,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Pagination' });
	const className = cx('Pagination', customClassName, themeClassName);
	const maxRowsSelectorTheme = merge({}, themeMaxRowsSelectorProps, customMaxRowSelectorProps);
	const pageSelectorTheme = merge({}, themePageSelectorProps, customPageSelectorProps);

	return useMemo(
		() => (
			<section
				className={className}
				css={[
					themeCSS,
					css`
						align-items: flex-start;
						display: flex;
						justify-content: space-between;
					`,
					customCSS,
				]}
			>
				<MaxRowsSelector
					css={css`
						margin-left: 0.3rem;

						.Spinner {
							justify-content: space-between;
							width: 65%;
						}
					`}
					theme={maxRowsSelectorTheme}
				/>

				<PageSelector theme={pageSelectorTheme} />
			</section>
		),
		[className, customCSS, maxRowsSelectorTheme, pageSelectorTheme, themeCSS],
	);
};

export default Pagination;
