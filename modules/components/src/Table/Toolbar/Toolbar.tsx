import { css } from '@emotion/react';
import cx from 'classnames';
import { merge } from 'lodash-es';
import { useMemo } from 'react';

import ColumnSelectButton from '#Table/ColumnsSelectButton/index.js';
import CountDisplay from '#Table/CountDisplay/index.js';
import DownloadButton from '#Table/DownloadButton/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import getDisplayName from '#utils/getComponentDisplayName.js';
import { emptyObj } from '#utils/noops.js';

import type { ToolbarProps } from './types.js';

const Toolbar = ({
	css: customCSS,
	className: customClassName,
	theme: { CountDisplay: customCountDisplayProps, spacing: customSpacing, tools: customTools } = emptyObj,
}: ToolbarProps) => {
	const {
		components: {
			Table: {
				Toolbar: {
					className: themeClassName,
					css: themeCSS,
					CountDisplay: themeCountDisplayProps = emptyObj,
					spacing: themeSpacing = '0.4rem',
					tools: themeTools = [ColumnSelectButton, DownloadButton],
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Toolbar' });
	const tools = customTools ?? themeTools;
	const className = cx('Toolbar', customClassName, themeClassName);
	const countDisplayTheme = merge({}, themeCountDisplayProps, customCountDisplayProps);

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
				<CountDisplay
					css={css`
						flex-shrink: 0;
						margin: 0.3rem 0 0 0.3rem;
					`}
					theme={countDisplayTheme}
				/>

				<ul
					className="tools"
					css={css`
						display: flex;
						flex-wrap: wrap;
						justify-content: flex-end;
						list-style: none;
						margin: 0 0 -0.3rem 0.7rem;
						padding: 0;
					`}
				>
					{tools.map((Component, index) => (
						<li
							css={css`
								margin-left: ${customSpacing ?? themeSpacing};
								margin-bottom: 0.3rem;
							`}
							key={`${getDisplayName(Component)}-${index}`}
						>
							<Component />
						</li>
					))}
				</ul>
			</section>
		),
		[className, countDisplayTheme, customCSS, customSpacing, themeCSS, themeSpacing, tools],
	);
};

export default Toolbar;
