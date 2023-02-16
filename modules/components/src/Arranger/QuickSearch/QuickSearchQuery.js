import { capitalize, flatMap, isArray } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';

import { withQuery } from '../../Query';
import splitString from '../../utils/splitString';

const isValidValue = (value) => value?.trim()?.length > 1;

export const decorateFieldWithColumnsState = ({ tableConfigs, fieldName }) => {
	const columnsStateField = tableConfigs?.columns?.find((y) => y.fieldName === fieldName);

	return columnsStateField
		? {
				...columnsStateField,
				gqlField: fieldName.split('.').join('__'),
				query: columnsStateField.query || fieldName,
				jsonPath: columnsStateField.jsonPath || `$.${fieldName}`,
		  }
		: {};
};

const isMatching = ({ value = '', searchText = '', exact = false }) =>
	exact ? value === searchText : value.toLowerCase().includes(searchText.toLowerCase());

const enhance = compose(
	withProps(
		({
			exact,
			searchLowercase,
			quickSearchFields,
			searchTextDelimiters,
			searchText,
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
								fieldNames: quickSearchFields?.map((x) => x.fieldName),
							},
					  })),
			},
		}),
	),
	withQuery(
		({
			index,
			primaryKeyField,
			quickSearchFields,
			searchText,
			searchTextParts,
			size = 5,
			sqon,
		}) => ({
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
                  ${quickSearchFields?.map((f) => `${f.gqlField}: ${f.query}`)?.join('\n')}
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
			index,
			exact,
			searchText,
			searchTextParts,
			primaryKeyField,
			quickSearchFields,
			rawSearchResults: { data, loading },
			searchResultsByEntity = quickSearchFields?.map((x) => ({
				...x,
				results: data?.[index]?.hits?.edges
					?.map(
						({
							node,
							primaryKey = jp.query(
								{ [primaryKeyField.fieldName.split('.')[0]]: node.primaryKey },
								primaryKeyField.jsonPath,
							)[0],
							result = jp.query({ [x.fieldName.split('.')[0]]: node[x.gqlField] }, x.jsonPath)[0],
						}) => ({
							primaryKey,
							entityName: x.entityName,
							...searchTextParts.reduce(
								(acc, part) => {
									if (isArray(result)) {
										const r = result.find((r) => isMatching({ value: r, searchText: part, exact }));
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
						}),
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
	render,
	mapResults = () => ({}),
	sqon,
	searchResults,
	searchResultsByEntity,
	searchResultsLoading,
	searchTextParts,
	props = {
		searchTextParts,
		sqon,
		results: searchResults,
		resultsByEntity: searchResultsByEntity,
		loading: searchResultsLoading,
	},
}) => render({ ...props, ...mapResults(props) });

export default enhance(QuickSearchQuery);
