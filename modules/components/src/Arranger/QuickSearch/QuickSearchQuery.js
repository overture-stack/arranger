import { capitalize, flatMap } from 'lodash';
import { compose, withProps } from 'recompose';
import jp from 'jsonpath/jsonpath.min';

import { withQuery } from '../../Query';
import splitString from '../../utils/splitString';

const isValidValue = value => value?.trim()?.length > 1;

const enhance = compose(
  withProps(({ searchText }) => ({
    searchTextParts: splitString({ str: searchText, split: ['\\s', ','] }),
  })),
  withQuery(
    ({
      exact,
      projectId,
      index,
      primaryKeyField,
      quickSearchFields,
      searchText,
      searchTextParts,
      size = 5,
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
                  primaryKey: ${primaryKeyField?.field}
                  ${quickSearchFields
                    ?.map(f => `${f.gqlField}: ${f.query}`)
                    ?.join('\n')}
                }
              }
            }
          }
        }
      `,
      variables: {
        size,
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
      },
    }),
  ),
  withProps(
    ({
      index,
      searchText,
      searchTextParts,
      nestedFields,
      quickSearchFields,
      rawSearchResults: { data, loading },
      a = console.log(data),
      searchResultsByEntity = quickSearchFields?.map(x => ({
        ...x,
        results: data?.[index]?.hits?.edges
          ?.map(
            ({
              node: { primaryKey, ...node },
              result = jp.query(
                { [x.field.split('.')[0]]: node[x.gqlField] },
                x.jsonPath,
              )[0],
            }) => ({
              primaryKey,
              result,
              displayName: x.displayName,
              input: searchTextParts.find(y => result?.includes(y)),
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
          ?.map(({ displayName, field, results }) =>
            results?.map(({ input, primaryKey, result }) => ({
              entity: displayName,
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
  searchResults,
  searchResultsByEntity,
  searchResultsLoading,
  searchTextParts,
  props = {
    results: searchResults,
    resultsByEntity: searchResultsByEntity,
    loading: searchResultsLoading,
    searchTextParts,
  },
}) => render({ ...props, ...mapResults(props) });

export default enhance(QuickSearchQuery);
