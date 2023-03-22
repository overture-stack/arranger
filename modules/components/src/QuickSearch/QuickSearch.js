import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import Component from 'react-component-component';
import { css } from '@emotion/react';

import { withData } from '@/DataContext';
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

const inputRef = React.createRef();
const QuickSearch = ({
	apiFetcher,
	className,
	documentType,
	DropdownItemComponent = DropdownItem,
	headerTitle = 'Search by ID',
	Icon = FaSearch,
	InputComponent = TextInput,
	LoadingIcon = FaSearch,
	PinnedValueComponent = SQONBubble,
	placeholder = 'Quick Search',
	searchLowercase = false,
	searchTextDelimiters = ['\\s', ','],
	setSQON,
	sqon,
	style = emptyObj,
	...props
}) => {
	const [value, setValue] = useState('');
	const {
		components: {
			QuickSearch: {
				FilterInput: themeQuickSearchFilterInput = emptyObj,
				PinnedValues: {
					enabled: themePinnedValuesEnabled = true,
					theme: themePinnedValuesTheme,
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'QuickSearch' });

	return (
		<QuickSearchWrapper displayName={headerTitle} className={className} style={style}>
			<QuickSearchFieldsQuery
				{...props}
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
						searchLowercase={searchLowercase}
						searchTextDelimiters={searchTextDelimiters}
						render={({ results: searchResults, loading }) => (
							<Component initialState={{ dropDownExpanded: false }}>
								{({ state: { dropDownExpanded }, setState }) => {
									const showDropdown = () => setState({ dropDownExpanded: true });
									const hideDropdown = () => setState({ dropDownExpanded: false });

									return (
										<>
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
												placeholder={placeholder}
												type="text"
												value={value}
												{...themeQuickSearchFilterInput}
											/>
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

export default withData(QuickSearch);
