import { css } from '@emotion/react';
import cx from 'classnames';
import { merge } from 'lodash';
import { useMemo } from 'react';

import ColumnSelectButton from '@/Table/ColumnsSelectButton';
import CountDisplay from '@/Table/CountDisplay';
import DownloadButton from '@/Table/DownloadButton';
import { useThemeContext } from '@/ThemeContext';
import getDisplayName from '@/utils/getComponentDisplayName';
import { emptyObj } from '@/utils/noops';

import { ToolbarProps } from './types';

const Toolbar = ({
	css: customCSS,
	className: customClassName,
	theme: { CountDisplay: customCountDisplayProps } = emptyObj,
}: ToolbarProps) => {
	const {
		components: {
			Table: {
				Toolbar: {
					className: themeClassName,
					css: themeCSS,
					CountDisplay: themeCountDisplayProps = emptyObj,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - Toolbar' });
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

						.Spinner {
							justify-content: space-between;
							width: 65%;
						}
					`}
					theme={countDisplayTheme}
				/>

				<ul
					className="buttons"
					css={css`
						display: flex;
						flex-wrap: wrap;
						justify-content: flex-end;
						list-style: none;
						margin: 0 0 -0.3rem 0.7rem;
						padding: 0;
					`}
				>
					{/* TODO: Allow adding buttons here */}
					{[ColumnSelectButton, DownloadButton].map((Component) => (
						<li
							css={css`
								margin-left: 0.3rem;
								margin-bottom: 0.3rem;
							`}
							key={getDisplayName(Component)}
						>
							<Component />
						</li>
					))}
				</ul>
			</section>
		),
		[className, countDisplayTheme, customCSS, themeCSS],
	);
};

export default Toolbar;
