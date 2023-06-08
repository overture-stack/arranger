import { capitalize, flatMap, isArray, isEmpty } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';

import { withQuery } from '@/Query';
import { DEBUG } from '@/utils/config';
import splitString from '@/utils/splitString';

const isValidValue = (value) => value?.trim()?.length > 1;

export const decorateFieldWithColumnsState = ({ tableConfigs, fieldName }) => {
	if (fieldName) {
		const columnsStateField =
			tableConfigs?.columns?.find((column) => column.fieldName === fieldName) ||
			tableConfigs?.columns?.find((column) => column.fieldName === tableConfigs.rowIdFieldName) ||
			{};

		const splitFieldName = fieldName?.split?.('.');

		return {
			...columnsStateField,
			gqlField: splitFieldName.join('__'),
			jsonPath: `$..${splitFieldName?.length === 1 ? fieldName : splitFieldName.slice(-1)}`,
			query: columnsStateField.query || fieldName,
		};
	}

	DEBUG && console.info('Could not find fieldName to use for QuickSearch');

	return null;
};

const isMatching = ({ value = '', searchText = '', exact = false, who }) => {
	return exact ? value === searchText : value.toLowerCase().includes(searchText.toLowerCase());
};

const enhance = compose(
	withProps(
		({
			exact,
			searchFields,
			searchLowercase,
			searchText,
			searchTextDelimiters,
			searchTextParts = splitString({
				split: searchTextDelimiters,
				str: searchText,
			}).map((part) => (searchLowercase ? part.toLowerCase() : part)),
		}) => {
			return {
				searchTextParts,
				sqon: {
					content: exact
						? searchFields?.map(({ fieldName }) => ({
								content: {
									fieldName,
									value: searchTextParts,
								},
								op: 'in',
						  }))
						: searchTextParts.map((part) => ({
								content: {
									fieldNames: searchFields?.map((field) => field.fieldName || field),
									value: `*${part}*`,
								},
								op: 'filter',
						  })),
					op: 'or',
				},
			};
		},
	),
	withQuery(
		({ displayField, documentType, queryCallback, searchFields, searchText, size = 5, sqon }) => {
			return {
				callback: queryCallback,
				debounceTime: 300,
				endpointTag: 'Arranger-QuickSearch',
				query: `query ${capitalize(documentType)}QuickSearchResults($sqon: JSON, $size: Int) {
				${documentType} {
					hits(filters: $sqon, first: $size) {
					total
					edges {
						node {
						${!isEmpty(displayField?.query) ? `primaryKey: ${displayField?.query}` : ''}
						${
							searchFields
								?.filter?.((field) => field.gqlField && field.query)
								.map?.((field) => `${field.gqlField}: ${field.query}`)
								.join?.('\n') || ''
						}
						}
					}
					}
				}
				}
			`,
				shouldFetch: isValidValue(searchText) && (searchFields || []).length,
				variables: { size, sqon },
			};
		},
	),
	withProps(
		({
			displayField,
			documentType,
			exact,
			isNewSearch,
			response: { data, loading },
			searchFields,
			searchResultsByEntity: givenSearchResultsByEntity,
			searchText,
			searchTextParts,
		}) => {
			const searchResultsByEntity =
				givenSearchResultsByEntity ||
				searchFields?.map((field) => {
					return {
						...field,
						results: data?.[documentType]?.hits?.edges
							?.map(({ node }) => {
								const primaryKey =
									typeof node.primaryKey === 'string'
										? node.primaryKey
										: jp.query(node.primaryKey, displayField.jsonPath)[0];
								const result = field?.jsonPath && jp.query(node, field.jsonPath);

								return {
									primaryKey,
									entityName: field.entityName,
									...searchTextParts?.reduce(
										(acc, part) => {
											if (isArray(result)) {
												const r = result.find((value) => {
													return value ? isMatching({ value, searchText: part, exact }) : value;
												});

												if (r) {
													return { input: part, result: r };
												}
												return acc;
											}

											if (result && isMatching({ value: result, searchText: part, exact })) {
												return { input: part, result };
											}

											return acc;
										},
										{ input: '', result: '' },
									),
								};
							})
							?.filter((x) => isValidValue(searchText) && x.input),
					};
				}) ||
				[];

			return {
				searchResultsByEntity,
				searchResultsLoading: isNewSearch || loading,
				searchResults: flatMap(
					searchResultsByEntity
						?.filter((value) => value?.results?.length)
						?.map(({ entityName, field, results }) =>
							results?.map(({ input, primaryKey, result }) => ({
								entityName,
								field,
								input,
								primaryKey,
								result,
							})),
						),
				),
			};
		},
	),
);

const QuickSearchQuery = ({
	apiFetcher,
	mapResults = () => ({}),
	render,
	searchResults,
	searchResultsByEntity,
	searchResultsLoading,
	searchTextParts,
	sqon,
}) => {
	const props = {
		apiFetcher,
		loading: searchResultsLoading,
		results: searchResults,
		resultsByEntity: searchResultsByEntity,
		searchTextParts,
		sqon,
	};

	return render({ ...props, ...mapResults(props) });
};

export default enhance(QuickSearchQuery);
