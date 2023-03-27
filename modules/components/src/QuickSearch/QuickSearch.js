import { createRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import Component from 'react-component-component';
import { css } from '@emotion/react';

import { useDataContext } from '@/DataContext';
import { Value as SQONBubble } from '@/SQONViewer';
import { currentFieldValue, toggleSQON } from '@/SQONViewer/utils';
import TextFilter from '@/TextFilter';
import { emptyObj } from '@/utils/noops';
import internalTranslateSQONValue from '@/utils/translateSQONValue';
import { useThemeContext } from '@/ThemeContext';

import QuickSearchQuery from './QuickSearchQuery';
import QuickSearchFieldsQuery from './QuickSearchFieldsQuery';
import DropdownItem from './QuickSearchDropdown';
import QuickSearchWrapper from './QuickSearchWrapper';

const currentValues = ({ sqon, primaryKeyField }) =>
	currentFieldValue({ sqon, dotFieldName: primaryKeyField?.fieldName, op: 'in' });

const toggleValue = ({ sqon, setSQON, primaryKeyField, primaryKey }) =>
	setSQON(
		toggleSQON(
			{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							fieldName: primaryKeyField?.fieldName,
							value: [].concat(primaryKey || []),
						},
					},
				],
			},
			sqon,
		),
	);

const inputRef = createRef();
const QuickSearch = ({
	theme: {
		FilterInput: {
			border: customFilterInputBorder,
			boxShadow: customFilterInputBoxShadow,
			placeholder: customFilterInputPlaceholder,
		} = emptyObj,
	} = emptyObj,
}) => {
	const [value, setValue] = useState('');
	const { apiFetcher, documentType, sqon, setSQON } = useDataContext();
	const {
		components: {
			QuickSearch: {
				DropDownItems: {
					DropdownItemComponent = DropdownItem,
					css: themeDropDownItemsCss = emptyObj,
				} = emptyObj,
				FilterInput: {
					borderColor: themeFilterInputBorder,
					boxShadow: themeFilterInputBoxShadow,
					css: themeFilterInputCSS,
					Icon = FaSearch,
					InputComponent = TextFilter,
					LoadingIcon = FaSearch,
					placeholder: themeFilterInputPlaceholder = 'Quick Search',
				} = emptyObj,
				QuickSearchQuery: {
					searchLowercase: themeQuickSearchQuerySearchLowercase = false,
					searchTextDelimiters: themeQuickSearchQuerySearchTextDelimiters = ['\\s', ','],
				} = emptyObj,
				QuickSearchWrapper: {
					headerTitle: themeQuickSearchWrapperHeaderTitle = 'Search by ID',
					className: themeQuickSearchWrapperClassName = '',
					style: themeQUickSearchWrapperStyle = emptyObj,
				} = emptyObj,
				PinnedValues: {
					enabled: themePinnedValuesEnabled = true,
					PinnedValueComponent = SQONBubble,
					css: themePinnedValuesCss,
					...themePinnedValuesTheme
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'QuickSearch' });

	const handleInputChange = ({ value } = {}) => setValue(value);

	return (
		<QuickSearchWrapper
			displayName={themeQuickSearchWrapperHeaderTitle}
			className={themeQuickSearchWrapperClassName}
			stickyHeader
			style={themeQUickSearchWrapperStyle}
		>
			<QuickSearchFieldsQuery
				apiFetcher={apiFetcher}
				documentType={documentType}
				primaryKeyField
				render={({
					enabled,
					primaryKeyField,
					quickSearchFields,
					quickSearchEntities,
					entityIndexLookup = quickSearchEntities.reduce(
						(obj, x, i) => ({ ...obj, [x.entityName]: i }),
						{},
					),
					...props
				}) => (
					<QuickSearchQuery
						{...props}
						{...{ primaryKeyField, quickSearchFields }}
						apiFetcher={apiFetcher}
						index={documentType}
						searchText={value}
						searchLowercase={themeQuickSearchQuerySearchLowercase}
						searchTextDelimiters={themeQuickSearchQuerySearchTextDelimiters}
						render={({ results: searchResults, loading }) => (
							<Component initialState={{ dropDownExpanded: false }}>
								{({ state: { dropDownExpanded }, setState }) => {
									const showDropdown = () => setState({ dropDownExpanded: true });
									const hideDropdown = () => setState({ dropDownExpanded: false });

									return (
										<>
											<InputComponent
												onBlur={hideDropdown}
												onChange={handleInputChange}
												onFocus={showDropdown}
												theme={{
													altText: 'Quick search',
													disabled: !enabled,
													borderColor: customFilterInputBorder || themeFilterInputBorder,
													boxShadow: customFilterInputBoxShadow || themeFilterInputBoxShadow,
													css: themeFilterInputCSS,
													leftIcon: {
														Icon: loading ? LoadingIcon : Icon,
													},
													placeholder: customFilterInputPlaceholder || themeFilterInputPlaceholder,
													ref: inputRef,
													showClear: true,
												}}
												value={value}
											/>

											{dropDownExpanded && searchResults?.length > 0 && (
												<div
													className="quick-search-results"
													css={css`
														${themeDropDownItemsCss}
													`}
												>
													{searchResults?.map(
														(
															{
																entityName,
																result,
																primaryKey,
																input,
																index = (entityIndexLookup[entityName] % 5) + 1,
															},
															i,
														) => {
															return (
																<DropdownItemComponent
																	aria-label={`${result}-${i}`}
																	entityName={entityName}
																	inputValue={input}
																	key={`${result}-${i}`}
																	onMouseDown={() => {
																		// onMouseDown because the input's onBlur would prevent onClick from triggering
																		setValue('');

																		if (
																			!currentValues({
																				primaryKeyField,
																				sqon,
																			})?.includes(primaryKey)
																		) {
																			toggleValue({
																				primaryKey,
																				primaryKeyField,
																				setSQON,
																				sqon,
																			});
																		}
																	}}
																	optionIndex={index}
																	primaryKey={primaryKey}
																	result={result}
																/>
															);
														},
													)}
												</div>
											)}

											{themePinnedValuesEnabled && (
												<div className="quick-search-pinned-values">
													{currentValues({
														sqon,
														primaryKeyField,
													})?.map((primaryKey) => (
														<div
															className="quick-search-pinned-value"
															key={primaryKey}
															css={css`
																margin-bottom: 10px;
															`}
														>
															<PinnedValueComponent
																css={css`
																	${themePinnedValuesCss}
																`}
																theme={themePinnedValuesTheme}
																onClick={() =>
																	toggleValue({
																		sqon,
																		setSQON,
																		primaryKeyField,
																		primaryKey,
																	})
																}
															>
																{internalTranslateSQONValue(primaryKey)}
															</PinnedValueComponent>
														</div>
													))}
												</div>
											)}
										</>
									);
								}}
							</Component>
						)}
					/>
				)}
			/>
		</QuickSearchWrapper>
	);
};

export default QuickSearch;
