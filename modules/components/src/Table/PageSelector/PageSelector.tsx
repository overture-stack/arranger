import {
	ChangeEventHandler,
	FormEventHandler,
	MouseEventHandler,
	useCallback,
	useEffect,
	useState,
} from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import { TransparentButton } from '@/Button';
import { useTableContext } from '@/Table/helpers';
import { useThemeContext } from '@/ThemeContext';
import { TooltippedForm, TooltippedLI } from '@/Tooltip';
import { emptyObj } from '@/utils/noops';
import useDebounce from '@/utils/useDebounce';

import { PageSelectorProps } from './types';

const PageSelector = ({
	className: customClassName,
	css: customCSS,
	theme: {
		borderColor: customBorderColor,
		borderErrorColor: customBorderErrorColor,
		borderRadius: customBorderRadius,
		changePageOnTimeout: customChangePageOnTimeout,
		disabledFontColor: customDisabledFontColor,
		fontColor: customFontColor,
		fontSize: customFontSize,
		showTotalPages: customShowTotalPages,
	} = emptyObj,
}: PageSelectorProps) => {
	const [inputHasError, setInputHasError] = useState(false);
	const { currentPage, maxPages, maxResultsWindow, setCurrentPage, total, totalPages } =
		useTableContext({
			callerName: 'Table - PageSelector',
		});

	const {
		colors,
		components: {
			Table: {
				PageSelector: {
					borderColor: themeBorderColor = colors?.grey?.[300],
					borderErrorColor: themeBorderErrorColor = colors?.red?.[600],
					borderRadius: themeBorderRadius = '0.3rem',
					changePageOnTimeout: themeChangePageOnTimeout = false,
					className: themeClassName,
					css: themeCSS,
					disabledFontColor: themeDisabledFontColor = colors?.grey?.[400],
					fontColor: themeFontColor = colors?.grey?.[700],
					fontSize: themeFontSize = '0.8rem',
					showTotalPages: themeShowTotalPages,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Table - PageSelector' });

	const disabledFontColor = customDisabledFontColor || themeDisabledFontColor;
	const inputBorderColor = inputHasError
		? customBorderErrorColor || themeBorderErrorColor
		: customBorderColor || themeBorderColor;
	const shouldChangeOntimeout = customChangePageOnTimeout || themeChangePageOnTimeout;

	const firstPage = 1;
	const displayPage = currentPage + 1;
	const lastPage = Math.min(maxPages, totalPages);
	const maxResults = maxResultsWindow?.toLocaleString();

	const isFirstPage = displayPage === firstPage;
	const isLastPage = displayPage === lastPage;

	const [currentInput, setCurrentInput] = useState(displayPage?.toString?.());
	const isInputbeyondRange = lastPage && Number(currentInput) > lastPage;

	const debouncedNewPage = useDebounce(
		currentInput?.length ? Number(currentInput) : displayPage,
		1000,
	);

	const attemptToChangePage = useCallback(
		(value: number) => {
			const newPageIsInvalid = !(lastPage > 0 && value > 0 && value <= lastPage);

			newPageIsInvalid || setCurrentPage(value - 1);
			setInputHasError(newPageIsInvalid);
		},
		[lastPage, setCurrentPage],
	);

	const handlePageJump =
		(selected = 1): MouseEventHandler =>
		() => {
			if (selected > 0 && selected <= lastPage) {
				setCurrentPage(selected - 1);
			} else {
				console.log('what happened!? selected page:', selected);
			}
		};

	const handlePageInputBlur: ChangeEventHandler<HTMLInputElement> = (event) => {
		// const value = event.target.value;

		setCurrentInput((currentPage + 1).toString());
	};

	const handlePageInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		const value = event.target.value;

		setCurrentInput(value);
	};

	const handlePageInputSubmit: FormEventHandler<HTMLFormElement> = (event) => {
		event?.preventDefault();

		attemptToChangePage(Number(currentInput));
	};

	useEffect(() => {
		shouldChangeOntimeout && attemptToChangePage(debouncedNewPage);
	}, [attemptToChangePage, debouncedNewPage, shouldChangeOntimeout]);

	useEffect(() => {
		setCurrentInput((currentPage + 1).toString());
	}, [currentPage]);

	return (
		<article
			className={cx('PageSelector', customClassName, themeClassName)}
			css={[
				css`
					color: ${customFontColor || themeFontColor};
					font-size: ${customFontSize || themeFontSize};
				`,
				themeCSS,
				customCSS,
			]}
		>
			<ul
				css={css`
					align-items: center;
					display: flex;
					list-style: none;
					margin: 0;

					li {
						align-items: center;
						display: flex;

						&:first-of-type {
							margin-right: 0.8rem;
						}

						&:last-of-type {
							margin-left: 0.8rem;
						}
					}
				`}
				role="navigation"
				aria-label="Pagination"
			>
				<TooltippedLI className="before">
					{totalPages > 1 && (
						<TransparentButton
							className="first"
							css={css`
								margin-right: 0.3rem;
							`}
							disabled={isFirstPage}
							onClick={handlePageJump(firstPage)}
							theme={{
								disabledFontColor,
							}}
						>
							{'<<'}
						</TransparentButton>
					)}

					{totalPages > 2 && (
						<TransparentButton
							className="previous"
							disabled={isFirstPage}
							onClick={handlePageJump(displayPage - 1)}
							theme={{
								disabledFontColor,
							}}
						>
							{'<'}
						</TransparentButton>
					)}
				</TooltippedLI>

				<TooltippedLI
					className="current"
					css={css`
						display: flex;
					`}
				>
					<span>Page</span>

					{
						// is it worth showing an input field?
						totalPages > 2 ? (
							<TooltippedForm
								onSubmit={handlePageInputSubmit}
								theme={{
									tooltipText: isInputbeyondRange
										? `Page ${lastPage} is the last available`
										: `Press "Enter" to go`,
									tooltipVisibility: isInputbeyondRange ? 'always' : 'hover',
								}}
							>
								<input
									css={css`
										border: 0.1rem solid ${inputBorderColor};
										border-radius: ${customBorderRadius || themeBorderRadius};
										color: ${customFontColor || themeFontColor};
										font-size: calc(${customFontSize || themeFontSize} * 0.9);
										margin: 0.1rem 0.2rem 0;
										width: 1.4rem;
										padding: 0.1rem 0.3rem;
										text-align: right;

										&::-webkit-inner-spin-button,
										&::-webkit-outer-spin-button {
											-webkit-appearance: none;
											margin: 0;
										}
									`}
									min={1}
									max={lastPage}
									name="page-selection-input"
									onChange={handlePageInputChange}
									onBlur={handlePageInputBlur}
									type="number"
									value={currentInput}
								/>
							</TooltippedForm>
						) : (
							<span
								css={css`
									margin: 0 0.3rem;
								`}
							>
								{total > 0 ? displayPage : '...'}
							</span>
						)
					}

					{
						// do we have more than 1 page?
						totalPages > 1 && (customShowTotalPages || themeShowTotalPages) && (
							<span>{`of ${totalPages}`}</span>
						)
					}
				</TooltippedLI>

				<TooltippedLI
					className="after"
					theme={{
						tooltipAlign: 'top left' as const,
						tooltipText:
							isLastPage &&
							totalPages > lastPage &&
							total > maxResultsWindow &&
							`This table is limited to ${maxResults} results`,
					}}
				>
					{totalPages > 2 && (
						<TransparentButton
							className="next"
							disabled={isLastPage}
							onClick={handlePageJump(displayPage + 1)}
							theme={{
								disabledFontColor,
							}}
						>
							{'>'}
						</TransparentButton>
					)}

					{totalPages > 1 && (
						<TransparentButton
							className="last"
							css={css`
								margin-left: 0.3rem;
							`}
							disabled={isLastPage}
							onClick={handlePageJump(lastPage)}
							theme={{
								disabledFontColor,
							}}
						>
							{'>>'}
						</TransparentButton>
					)}
				</TooltippedLI>
			</ul>
		</article>
	);
};

export default PageSelector;
