import React from 'react';
import { css } from 'emotion';
import { capitalize, flatMap, uniq } from 'lodash';
import { compose, withProps, withState } from 'recompose';
import SearchIcon from 'react-icons/lib/fa/search';
import jp from 'jsonpath/jsonpath.min';

import { Value as SQONBubble } from '../SQONView';
import { currentFieldValue, toggleSQON } from '../SQONView/utils';
import TextInput from '../Input';
import { withQuery } from '../Query';
import TextHighlight from '../TextHighlight';

const nestedField = ({ field, nestedFields }) =>
  nestedFields.find(
    x =>
      x.field ===
      field.field
        .split('.')
        .slice(0, -1)
        .join('.'),
  );

const isValidValue = value => value?.length > 1;

const currentValues = ({ sqon, primaryKeyField }) =>
  currentFieldValue({ sqon, dotField: primaryKeyField.field, op: 'in' });

const toggleValue = ({ sqon, setSQON, primaryKeyField, primaryKey }) =>
  setSQON(
    toggleSQON(
      {
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: primaryKeyField?.field,
              value: [].concat(primaryKey || []),
            },
          },
        ],
      },
      sqon,
    ),
  );

const enhance = compose(
  withState('value', 'setValue', ''),
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
  withProps(({ index, extendedFields: { data, loading, error } }) => ({
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
  })),
  withQuery(
    ({
      projectId,
      index,
      primaryKeyField,
      quickSearchFields,
      value,
      size = 5,
    }) => ({
      debounceTime: 300,
      shouldFetch: isValidValue(value) && quickSearchFields.length,
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
          op: 'filter',
          content: {
            value,
            fields: quickSearchFields?.map(x => x.field),
          },
        },
      },
    }),
  ),
  withProps(
    ({
      index,
      value,
      nestedFields,
      quickSearchFields,
      rawSearchResults: { data, loading },
      searchResults = quickSearchFields?.map(x => ({
        ...x,
        displayName:
          nestedField({ field: x, nestedFields })?.displayName || index,
        results: data?.[index]?.hits?.edges
          ?.map(({ node: { primaryKey, ...node } }) => ({
            primaryKey,
            result: jp.query(
              { [x.field.split('.')[0]]: node[x.gqlField] },
              x.jsonPath,
            )[0],
          }))
          ?.filter(x => isValidValue(value) && x.result.includes(value)),
      })) || [],
      searchResultIndexLookup = uniq(
        searchResults.map(x => x.displayName),
      ).reduce((obj, x, i) => ({ ...obj, [x]: i }), {}),
    }) => ({
      searchResults,
      searchResultIndexLookup,
      searchResultsLoading: loading,
    }),
  ),
);

const inputRef = React.createRef();
const QuickSearch = ({
  sqon,
  setSQON,
  primaryKeyField,
  quickSearchFields,
  nestedFields,
  searchResults,
  searchResultIndexLookup,
  searchResultsLoading,
  value,
  setValue,
  placeholder = 'Quick Search',
  Icon = <SearchIcon />,
  LoadingIcon = <SearchIcon />,
  PinnedValueComponent = SQONBubble,
}) =>
  primaryKeyField && quickSearchFields?.length ? (
    <div className="quick-search">
      <div className="quick-search-pinned-values">
        {currentValues({ sqon, primaryKeyField })?.map(primaryKey => (
          <div className="quick-search-pinned-value">
            <PinnedValueComponent
              onClick={() =>
                toggleValue({ sqon, setSQON, primaryKeyField, primaryKey })
              }
            >
              {primaryKey}
            </PinnedValueComponent>
          </div>
        ))}
      </div>
      <TextInput
        icon={searchResultsLoading ? LoadingIcon : Icon}
        type="text"
        value={value}
        componentRef={inputRef}
        placeholder={placeholder}
        onChange={({ target: { value } }) => setValue((value || '').trim())}
      />

      <div
        className={css`
          position: relative;
        `}
      >
        {searchResults?.some(x => x.results?.length) && (
          <div
            className={`quick-search-results ${css`
              position: absolute;
              top: 0;
              left: 0;
              margin: 0;
              padding: 0;
              z-index: 1;
              background: white;
              width: ${inputRef.current?.getBoundingClientRect()?.width}px;
            `}`}
          >
            {flatMap(
              searchResults.map(
                ({
                  results,
                  displayName,
                  index = searchResultIndexLookup[displayName] % 5 + 1,
                }) =>
                  results.map(({ primaryKey, result }, i) => (
                    <div
                      key={i}
                      className={`quick-search-result ${css`
                        cursor: pointer;
                      `}`}
                      onClick={() => {
                        setValue('');
                        if (
                          !currentValues({ sqon, primaryKeyField })?.includes(
                            primaryKey,
                          )
                        ) {
                          toggleValue({
                            sqon,
                            setSQON,
                            primaryKeyField,
                            primaryKey,
                          });
                        }
                      }}
                    >
                      <div
                        className={`quick-search-result-entity quick-search-result-entity-${index}`}
                      >
                        <div>{displayName.slice(0, 2).toUpperCase()}</div>
                      </div>
                      <div className="quick-search-result-details">
                        <div className="quick-search-result-key">
                          {primaryKey}
                        </div>
                        <div className="quick-search-result-value">
                          <TextHighlight
                            highlightClassName={`quick-search-result-value-highlight ${css`
                              font-weight: bold;
                            `}`}
                            highlightText={value}
                            content={result}
                          />
                        </div>
                      </div>
                    </div>
                  )),
              ),
            )}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div />
  );

export default enhance(QuickSearch);
