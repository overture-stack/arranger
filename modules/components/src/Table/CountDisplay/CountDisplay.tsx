import { css } from '@emotion/react';
import cx from 'classnames';
import pluralize from 'pluralize';

import { useTableContext } from '#Table/helpers/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import { isPlural } from './helpers.js';
import type { CountDisplayProps } from './types.js';

const CountDisplay = ({
	className: customClassName,
	css: customCSS,
	theme: { fontColor: customFontColor, fontSize: customFontSize, spacing: customSpacing } = emptyObj,
}: CountDisplayProps) => {
	const { currentPage, documentType, isLoading, pageSize, missingProvider, total } = useTableContext({
		callerName: 'Table - CountDisplay',
	});
	const {
		colors,
		components: {
			Table: {
				CountDisplay: {
					className: themeClassName,
					css: themeCSS,
					fontColor: themeFontColor = colors?.grey?.[700],
					fontSize: themeFontSize = '0.8rem',
					spacing: themeSpacing = '0.2rem',
				} = emptyObj,
				Toolbar: { spacing: themeToolbarSpacing } = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - CountDisplay' });

	const hasData = total > 0;

	const oneOrManyDocuments =
		missingProvider || pluralize(documentType, isPlural({ total, pageSize, currentPage }) ? 2 : 1);

	return (
		<article
			className={cx('currentlyDisplayed', customClassName, themeClassName)}
			css={[
				themeCSS,
				css`
					align-items: center;
					color: ${customFontColor ?? themeFontColor};
					display: flex;
					flex-grow: 1;
					font-size: ${customFontSize ?? themeFontSize};

					> * {
						flex: 0 0 auto;

						&:not(:first-of-type) {
							margin-left: ${customSpacing ?? themeSpacing ?? themeToolbarSpacing};
						}
					}
				`,
				customCSS,
			]}
		>
			{missingProvider ? (
				<span className="noProvider">The counter is missing its {missingProvider || 'context'} provider.</span>
			) : isLoading ? (
				<span className="loading">{`Loading ${oneOrManyDocuments}...`}</span>
			) : (
				<>
					<span className="showing">Showing</span>
					{hasData ? (
						<>
							<span className="numbers">
								{`${(currentPage * pageSize + 1).toLocaleString()} - ${Math.min(
									(currentPage + 1) * pageSize,
									total,
								).toLocaleString()}`}
							</span>{' '}
							<span className="ofTotal">of {total?.toLocaleString()}</span>{' '}
						</>
					) : (
						<span className="numbers">{total}</span>
					)}
					<span className="type">{oneOrManyDocuments}</span>
				</>
			)}
		</article>
	);
};

export default CountDisplay;
