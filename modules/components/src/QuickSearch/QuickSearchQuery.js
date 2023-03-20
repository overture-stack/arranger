import { capitalize, flatMap, isArray } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';

import { withQuery } from '@/Query';
import splitString from '@/utils/splitString';

const isValidValue = (value) => value?.trim()?.length > 1;

export const decorateFieldWithColumnsState = ({ tableConfigs, fieldName }) => {
	const columnsStateField = tableConfigs?.columns?.find((y) => y.fieldName === fieldName);

	return columnsStateField
		? {
				...columnsStateField,
				gqlField: fieldName.split('.').join('__'),
				query: columnsStateField.query || fieldName,
				jsonPath: `$..${fieldName.split('.').slice(-1)}`,
		  }
		: {};
};

const isMatching = ({ value = '', searchText = '', exact = false }) => {
	return exact ? value === searchText : value.toLowerCase().includes(searchText.toLowerCase());
};

const enhance = compose(
	withProps(
		({
			exact,
			quickSearchFields,
			searchLowercase,
			searchText,
			searchTextDelimiters,
			searchTextParts = splitString({
				str: searchText,
				split: searchTextDelimiters,
			}).map((part) => (searchLowercase ? part.toLowerCase() : part)),
		}) => ({
			searchTextParts,
			sqon: {
				op: 'or',
				content: exact
					? quickSearchFields?.map(({ fieldName }) => ({
							op: 'in',
							content: {
								fieldName,
								value: searchTextParts,
							},
					  }))
					: searchTextParts.map((x) => ({
							op: 'filter',
							content: {
								value: `*${x}*`,
								fieldNames: quickSearchFields?.map((x) => x.fieldName || x),
							},
					  })),
			},
		}),
	),
	withQuery(
		({ index, primaryKeyField, quickSearchFields, queryFields, searchText, size = 5, sqon }) => ({
			debounceTime: 300,
			shouldFetch: isValidValue(searchText) && (quickSearchFields || []).length,
			key: 'rawSearchResults',
			query: `
        query ${capitalize(index)}QuickSearchResults($sqon: JSON, $size: Int) {
          ${index} {
            hits(filters: $sqon, first: $size) {
              total
              edges {
                node {
                  primaryKey: ${primaryKeyField?.query}
                  ${queryFields?.map((f) => `${f.gqlField}: ${f.query}`)?.join('\n') || ''}
                }
              }
            }
          }
        }
      `,
			variables: { size, sqon },
		}),
	),
	withProps(
		({
			exact,
			index,
			primaryKeyField,
			queryFields,
			rawSearchResults: { data, loading },
			searchText,
			searchTextParts,
			searchResultsByEntity = queryFields?.map((x) => ({
				...x,
				results: data?.[index]?.hits?.edges
					?.map(
						({
							node,
							primaryKey = jp.query(node.primaryKey, primaryKeyField.jsonPath)[0],
							result = jp.query(node, x.jsonPath),
						}) => {
							return {
								primaryKey,
								entityName: x.entityName,
								...searchTextParts.reduce(
									(acc, part) => {
										if (isArray(result)) {
											const r = result.find((r) =>
												isMatching({ value: r, searchText: part, exact }),
											);
											if (r) {
												return { input: part, result: r };
											}
											return acc;
										}
										if (isMatching({ value: result, searchText: part, exact })) {
											return { input: part, result };
										}
										return acc;
									},
									{ input: '', result: '' },
								),
							};
						},
					)
					?.filter((x) => isValidValue(searchText) && x.input),
			})) || [],
		}) => ({
			searchResultsByEntity,
			searchResultsLoading: loading,
			searchResults: flatMap(
				searchResultsByEntity
					?.filter((x) => x?.results?.length)
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
		}),
	),
);

const QuickSearchQuery = ({
	apiFetcher,
	mapResults = () => ({}),
	render,
	sqon,
	searchResults,
	searchResultsByEntity,
	searchResultsLoading,
	searchTextParts,
	props = {
		apiFetcher,
		loading: searchResultsLoading,
		results: searchResults,
		resultsByEntity: searchResultsByEntity,
		searchTextParts,
		sqon,
	},
}) => render({ ...props, ...mapResults(props) });

export default enhance(QuickSearchQuery);
