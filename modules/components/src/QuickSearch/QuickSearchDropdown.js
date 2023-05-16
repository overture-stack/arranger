import { css } from '@emotion/react';

import TextHighlight from '@/TextHighlight';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

const QuickSearchDropdownItem = ({
	entityName,
	inputValue,
	onMouseDown,
	optionIndex,
	primaryKey,
	result,
}) => {
	const {
		components: {
			QuickSearch: {
				DropDownItems: {
					entityLogo: {
						borderRadius: themeEntityLogoBorderRadius = '50%',
						color1: themeEntityLogoColor1 = '#a42c90',
						color2: themeEntityLogoColor2 = '#00afed',
						color3: themeEntityLogoColor3 = '#ff9324',
						color4: themeEntityLogoColor4 = '#009bb8',
						color5: themeEntityLogoColor5 = '#d8202f',
						css: themeEntityLogoCss = emptyObj,
						enabled: themeEntityLogoEnabled = true,
						margin: themeEntityLogoMargin = '6px',
						width: themeEntityLogoWidth = '14%',
					} = emptyObj,
					evenRowColor: themeDropDownItemsEvenRowColor = '#f4f5f8',
					lineHeight: themeDropdownItemsLineHeight = '220%',
					resultKeyText: {
						css: themeResultKeyTextCss = emptyObj,
						fontSize: themeResultKeyTextFontSize = '0.9em',
					} = emptyObj,
					resultValue: {
						css: themeResultValueCss = emptyObj,
						fontSize: themeResultValueFontSize = '0.7em',
					} = emptyObj,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'QuickSearch' });

	const logoEntityColors = {
		1: themeEntityLogoColor1,
		2: themeEntityLogoColor2,
		3: themeEntityLogoColor3,
		4: themeEntityLogoColor4,
		5: themeEntityLogoColor5,
	};

	return (
		<div
			className="quick-search-result"
			css={
				onMouseDown &&
				css`
					cursor: pointer;
					display: flex;
					align-items: center;

					&:hover {
						box-shadow: inset 0px 0px 15px 0px rgba(0, 0, 0, 0.1);
					}

					&:nth-of-type(even) {
						background-color: ${themeDropDownItemsEvenRowColor};
					}
				`
			}
			onMouseDown={onMouseDown}
			role="presentation"
			title={primaryKey}
		>
			{themeEntityLogoEnabled && (
				<div
					className={`quick-search-result-entity quick-search-result-entity-${optionIndex}`}
					css={css`
						background-color: ${logoEntityColors[optionIndex]};
						border-radius: ${themeEntityLogoBorderRadius};
						width: ${themeEntityLogoWidth};
						margin: ${themeEntityLogoMargin};
						display: flex;
						align-items: center;
						justify-content: center;

						&:before {
							content: '';
							float: left;
							padding-top: 100%;
						}
						${themeEntityLogoCss}
					`}
				>
					<div>{entityName.slice(0, 2).toUpperCase()}</div>
				</div>
			)}

			<div
				className="quick-search-result-details"
				css={css`
					overflow: hidden;
				`}
			>
				<div
					className="quick-search-result-key"
					css={css`
						font-size: ${themeResultKeyTextFontSize};
						line-height: ${themeDropdownItemsLineHeight};
						${themeResultKeyTextCss}
					`}
				>
					<TextHighlight highlightText={inputValue} content={primaryKey} />
				</div>

				{primaryKey === result || (
					<div
						className="quick-search-result-value"
						css={css`
							overflow: hidden;
							text-overflow: ellipsis;
							font-size: ${themeResultValueFontSize};
							white-space: nowrap;
							${themeResultValueCss}
						`}
					>
						<TextHighlight highlightText={inputValue} content={result} />
					</div>
				)}
			</div>
		</div>
	);
};

export default QuickSearchDropdownItem;
