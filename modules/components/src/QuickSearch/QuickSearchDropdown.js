import { css } from '@emotion/react';

import TextHighlight from '@/TextHighlight';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj, noopFn } from '@/utils/noops';

const QuickSearchDropdownItem = ({
	entityName,
	inputValue,
	onMouseDown = noopFn,
	optionIndex,
	primaryKey,
	result,
}) => {
	const {
		components: {
			QuickSearch: {
				DropDownItems: {
					logoEntityEnabled: themeDropDownItemsLogoEntityEnabled = true,
					logoEntityColor1: themeDropDownItemsLogoEntityColor1 = '#a42c90',
					logoEntityColor2: themeDropDownItemsLogoEntityColor2 = '#00afed',
					logoEntityColor3: themeDropDownItemsLogoEntityColor3 = '#ff9324',
					logoEntityColor4: themeDropDownItemsLogoEntityColor4 = '#009bb8',
					logoEntityColor5: themeDropDownItemsLogoEntityColor5 = '#d8202f',
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'QuickSearch' });

	const logoEntityColors = {
		1: themeDropDownItemsLogoEntityColor1,
		2: themeDropDownItemsLogoEntityColor2,
		3: themeDropDownItemsLogoEntityColor3,
		4: themeDropDownItemsLogoEntityColor4,
		5: themeDropDownItemsLogoEntityColor5,
	};

	return (
		<div
			role="presentation"
			className="quick-search-result"
			css={css`
				cursor: pointer;
				display: flex;
				align-items: center;

				&:hover {
					box-shadow: inset 0px 0px 15px 0px rgba(0, 0, 0, 0.1);
				}

				&:nth-of-type(even) {
					background-color: #f4f5f8;
				}
			`}
			onMouseDown={onMouseDown}
		>
			{themeDropDownItemsLogoEntityEnabled && (
				<div
					className={`quick-search-result-entity quick-search-result-entity-${optionIndex}`}
					css={css`
						background-color: ${logoEntityColors[optionIndex]};
						border-radius: 50%;
						width: 14%;
						margin: 6px;
						display: flex;
						align-items: center;
						justify-content: center;

						&:before {
							content: '';
							float: left;
							padding-top: 100%;
						}
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
						font-size: 0.9em;
					`}
				>
					{primaryKey}
				</div>
				<div
					className="quick-search-result-value"
					css={css`
						overflow: hidden;
						text-overflow: ellipsis;
						font-size: 0.7em;
						white-space: nowrap;
					`}
				>
					<TextHighlight highlightText={inputValue} content={result} />
				</div>
			</div>
		</div>
	);
};

export default QuickSearchDropdownItem;
