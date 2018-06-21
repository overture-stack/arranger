import { capitalize, flatMap, isArray, isObject } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';

import { withQuery } from '../../Query';
import splitString from '../../utils/splitString';

export const findMatchingValues = ({ item, searchText }) => {
  let value;
  Object.keys(item || {}).some(function(k) {
    if (
      !isObject(item[k]) &&
      item[k] &&
      item[k].toLowerCase().indexOf(searchText.toLowerCase()) !== -1
    ) {
      value = item[k];
      return true;
    }
    if (item[k] && isObject(item[k])) {
      value = findMatchingValues({ item: item[k], searchText });
      return value !== undefined;
    }
    return false;
  });
  return value;
};

const isValidValue = value => value?.trim()?.length > 1;

export const decorateFieldWithColumnsState = ({ columnsState, field }) => {
  const columnsStateField = columnsState?.columns?.find(y => y.field === field);
  return columnsStateField
    ? {
        ...columnsStateField,
        gqlField: field.split('.').join('__'),
        query: columnsStateField.query || columnsStateField.accessor,
        jsonPath: columnsStateField.jsonPath || `$.${field}`,
      }
    : {};
};

const enhance = compose(
  withProps(
    ({
      exact,
      quickSearchFields,
      searchText,
      searchTextDelimiters,
      searchTextParts = splitString({
        str: searchText,
        split: searchTextDelimiters,
      }),
    }) => ({
      searchTextParts,
      sqon: {
        op: 'or',
        content: exact
          ? quickSearchFields?.map(({ field }) => ({
              op: 'in',
              content: {
                field,
                value: searchTextParts,
              },
            }))
          : searchTextParts.map(x => ({
              op: 'filter',
              content: {
                value: x,
                fields: quickSearchFields?.map(x => x.field),
              },
            })),
      },
    }),
  ),
  withQuery(
    ({
      projectId,
      index,
      primaryKeyField,
      quickSearchFields,
      searchText,
      searchTextParts,
      size = 5,
      sqon,
    }) => ({
      debounceTime: 300,
      shouldFetch: isValidValue(searchText) && quickSearchFields.length,
      projectId,
      key: 'rawSearchResults',
      query: `
        query ${capitalize(index)}QuickSearchResults($sqon: JSON, $size: Int) {
          ${index} {
            hits(filters: $sqon, first: $size) {
              total
              edges {
                node {
                  primaryKey: ${primaryKeyField?.query}
                }
                ${quickSearchFields
                  ?.map(f => `${f.gqlField}: node { ${f.query} }`)
                  ?.join('\n')}
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
      searchResultsByEntity = quickSearchFields?.map(x => {
        return {
          ...x,
          results: data?.[index]?.hits?.edges
            ?.reduce(
              (
                flatResults,
                {
                  node,
                  primaryKey = jp.query(
                    { [primaryKeyField.field.split('.')[0]]: node.primaryKey },
                    primaryKeyField.jsonPath,
                  )[0],
                  ...rest
                },
              ) => {
                const foundResults = searchTextParts.reduce((acc, part) => {
                  const foundValue = findMatchingValues({
                    item: rest[x.gqlField],
                    searchText: part,
                  });
                  if (foundValue) {
                    return [...acc, { input: part, result: foundValue }];
                  }
                  return acc;
                }, []);
                return [
                  ...flatResults,
                  ...foundResults.map(({ input, result }) => ({
                    primaryKey,
                    entityName: x.entityName,
                    input,
                    result,
                  })),
                ];
              },
              [],
            )
            ?.filter(x => isValidValue(searchText) && x.input),
        };
      }) || [],
    }) => ({
      searchResultsByEntity,
      searchResultsLoading: loading,
      searchResults: flatMap(
        searchResultsByEntity
          ?.filter(x => x?.results?.length)
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
