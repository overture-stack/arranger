import { css } from '@emotion/react';
import cx from 'classnames';
import pluralize from 'pluralize';

import Spinner from '#Loader/index.js';
import { useTableContext } from '#Table/helpers/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import { isPlural } from './helpers.js';
import type { CountDisplayProps } from './types.js';

const CountDisplay = ({
	className: customClassName,
	css: customCSS,
	theme: {
		fontColor: customFontColor,
		fontSize: customFontSize,
		hideLoader: customHideLoader,
		Loader: customSpinnerProps = emptyObj,
	} = emptyObj,
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
					hideLoader: themeHideLoader,
					fontColor: themeFontColor = colors?.grey?.[700],
					fontSize: themeFontSize = '0.8rem',
					Spinner: themeSpinnerProps = emptyObj,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - CountDisplay' });

	const hasData = total > 0;
	const hideLoader = customHideLoader || themeHideLoader;

	const oneOrManyDocuments =
		missingProvider || pluralize(documentType, isPlural({ total, pageSize, currentPage }) ? 2 : 1);

	return (
		<article
			className={cx('currentlyDisplayed', customClassName, themeClassName)}
			css={[
				themeCSS,
				css`
					align-items: center;
					color: ${customFontColor || themeFontColor};
					display: flex;
					flex-grow: 1;
					font-size: ${customFontSize || themeFontSize};

					> * {
						flex: 0 0 auto;
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
