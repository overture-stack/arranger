import { useMemo } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';
import { merge } from 'lodash';

import MaxRowsSelector from '@/Table/MaxRowsSelector';
import PageSelector from '@/Table/PageSelector';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { PaginationProps } from './types';

const Pagination = ({
	className: customClassName,
	theme: {
		MaxRowSelector: customMaxRowSelectorProps,
		PageSelector: customPageSelectorProps,
	} = emptyObj,
}: PaginationProps) => {
	const {
		components: {
			Table: {
				Pagination: {
					className: themeClassName,
					css: themeCss,
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
					css`
						align-items: flex-start;
						display: flex;
						justify-content: space-between;
					`,
					themeCss,
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
		[className, maxRowsSelectorTheme, pageSelectorTheme, themeCss],
	);
};

export default Pagination;
