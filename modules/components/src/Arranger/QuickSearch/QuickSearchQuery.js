import { capitalize } from 'lodash';
import { compose, withProps } from 'recompose';
import { withQuery } from '../../Query';
import jp from 'jsonpath/jsonpath.min';

const isValidValue = value => value?.trim()?.length > 1;

const nestedField = ({ field, nestedFields }) =>
  nestedFields.find(
    x =>
      x.field ===
      field.field
        .split('.')
        .slice(0, -1)
        .join('.'),
  );

const enhance = compose(
  withQuery(({ index, projectId }) => ({
    projectId,
    key: 'extendedFields',
    query: `
      query ${capitalize(index)}ExtendedQuery {
        ${index} {
          extended
          columnsState {
            state {
              columns {
                field
                query
                jsonPath
              }
            }
          }
        }
      }
    `,
  })),
  withProps(
    ({ index, searchText, extendedFields: { data, loading, error } }) => ({
      searchTextParts: searchText
        .split(new RegExp('[\\s,]', 'g'))
        .map(x => x?.trim())
        .filter(Boolean),
      quickSearchFields:
        data?.[index]?.extended
          ?.filter(x => x.quickSearchEnabled)
          ?.map(({ field }) =>
            data?.[index]?.columnsState?.state?.columns?.find(
              y => y.field === field,
            ),
          )
          ?.map(x => ({
            ...x,
            gqlField: x.field.split('.').join('__'),
            query: x.query || x.field,
            jsonPath: x.jsonPath || `$.${x.field}`,
          })) || [],
      primaryKeyField: data?.[index]?.extended?.find(x => x.primaryKey),
      nestedFields: data?.[index]?.extended?.filter(x => x.type === 'nested'),
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
          content: searchTextParts.map(x => ({
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
      searchResults = quickSearchFields?.map(x => ({
        ...x,
        displayName:
          nestedField({ field: x, nestedFields })?.displayName || index,
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
              matchedString: searchTextParts.find(y => result.includes(y)),
            }),
          )
          ?.filter(x => isValidValue(searchText) && x.matchedString),
      })) || [],
    }) => ({
      searchResults,
      searchResultsLoading: loading,
    }),
  ),
);

const QuickSearchQuery = ({
  render,
  mapResults = () => ({}),
  primaryKeyField,
  quickSearchFields,
  searchResults,
  searchResultsLoading,
}) =>
  render({
    enabled: primaryKeyField && quickSearchFields?.length,
    results: searchResults,
    loading: searchResultsLoading,
    primaryKeyField,
    ...mapResults({ results: searchResults }),
  });

export default enhance(QuickSearchQuery);
