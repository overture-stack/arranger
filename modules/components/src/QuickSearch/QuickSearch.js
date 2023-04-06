import { createRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import Component from 'react-component-component';
import { css } from '@emotion/react';

import { useDataContext, withData } from '@/DataContext';
import TextInput from '@/Input';
import { Value as SQONBubble } from '@/SQONViewer';
import { currentFieldValue, toggleSQON } from '@/SQONViewer/utils';
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
const QuickSearch = () => {
	const [value, setValue] = useState('');
	const { apiFetcher, documentType, sqon, setSQON } = useDataContext();
	const {
		components: {
			QuickSearch: {
				DropDownItems: { DropdownItemComponent = DropdownItem } = emptyObj,
				FilterInput: {
					css: themeFilterInputCSS,
					Icon = FaSearch,
					InputComponent = TextInput,
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

	return (
		<QuickSearchWrapper
			displayName={themeQuickSearchWrapperHeaderTitle}
			className={themeQuickSearchWrapperClassName}
			style={themeQUickSearchWrapperStyle}
		>
			<QuickSearchFieldsQuery
				apiFetcher={apiFetcher}
				index={documentType}
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
												aria-label={`Quick search`}
												componentRef={inputRef}
												disabled={!enabled}
												className="filter"
												leftIcon={{
													Icon: loading ? LoadingIcon : Icon,
												}}
												onBlur={hideDropdown}
												onChange={({ target: { value } = {} } = {}) => setValue(value || '')}
												onFocus={showDropdown}
												placeholder={themeFilterInputPlaceholder}
												type="text"
												value={value}
												css={themeFilterInputCSS}
											/>
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
											<>
												{!dropDownExpanded ? null : (
													<div className="quick-search-results">
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
											</>
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
