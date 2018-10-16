import { capitalize, flatMap } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';
import { head, isArray } from 'lodash';

import { withQuery } from '../../Query';
import splitString from '../../utils/splitString';

const isValidValue = value => value?.trim()?.length > 1;

export const decorateFieldWithColumnsState = ({ columnsState, field }) => {
  const columnsStateField = columnsState?.columns?.find(y => y.field === field);
  return columnsStateField
    ? {
        ...columnsStateField,
        gqlField: field.split('.').join('__'),
        query: columnsStateField.query || field,
        jsonPath: columnsStateField.jsonPath || `$.${field}`,
      }
    : {};
};

const isMatching = ({ value = '', searchText = '', exact = false }) =>
  exact
    ? value === searchText
    : value.toLowerCase().includes(searchText.toLowerCase());

const enhance = compose(
  withProps(
    ({
      exact,
      quickSearchFields,
      searchTextDelimiters,
      searchText,
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
      shouldFetch: isValidValue(searchText) && (quickSearchFields || []).length,
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
                  ${quickSearchFields
                    ?.map(f => `${f.gqlField}: ${f.query}`)
                    ?.join('\n')}
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
      searchResultsByEntity = quickSearchFields?.map(x => ({
        ...x,
        results: data?.[index]?.hits?.edges
          ?.map(
            ({
              node,
              primaryKey = jp.query(
                { [primaryKeyField.field.split('.')[0]]: node.primaryKey },
                primaryKeyField.jsonPath,
              )[0],
              result = jp.query(
                { [x.field.split('.')[0]]: node[x.gqlField] },
                x.jsonPath,
              )[0],
            }) => ({
              primaryKey,
              entityName: x.entityName,
              ...searchTextParts.reduce(
                (acc, part) => {
                  if (isArray(result)) {
                    const r = result.find(r =>
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
            }),
          )
          ?.filter(x => isValidValue(searchText) && x.input),
      })) || [],
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
