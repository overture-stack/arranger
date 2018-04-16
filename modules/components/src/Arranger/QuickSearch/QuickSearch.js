import React from 'react';
import { css } from 'emotion';
import { flatMap, uniq } from 'lodash';
import { compose, withState } from 'recompose';
import SearchIcon from 'react-icons/lib/fa/search';

import { Value as SQONBubble } from '../../SQONView';
import { currentFieldValue, toggleSQON } from '../../SQONView/utils';
import TextInput from '../../Input';
import TextHighlight from '../../TextHighlight';
import QuickSearchQuery from './QuickSearchQuery';

const currentValues = ({ sqon, primaryKeyField }) =>
<<<<<<< HEAD
  currentFieldValue({ sqon, dotField: primaryKeyField?.field, op: 'in' });
=======
  currentFieldValue({ sqon, dotField: primaryKeyField.field, op: 'in' });
>>>>>>> 4235363... :art: moved quick search query into its own component

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

const enhance = compose(withState('value', 'setValue', ''));

const inputRef = React.createRef();
const QuickSearch = ({
  index,
  projectId,
  className,
  sqon,
  setSQON,
  value,
  setValue,
  placeholder = 'Quick Search',
  Icon = <SearchIcon />,
  LoadingIcon = <SearchIcon />,
  PinnedValueComponent = SQONBubble,
}) => (
  <QuickSearchQuery
    index={index}
    projectId={projectId}
    searchText={value}
    mapResults={({ results }) => ({
      searchResultIndexLookup: uniq(results.map(x => x.displayName)).reduce(
        (obj, x, i) => ({ ...obj, [x]: i }),
        {},
      ),
    })}
    render={({
      enabled,
      results: searchResults,
      loading,
      primaryKeyField,
      searchResultIndexLookup,
<<<<<<< HEAD
    }) => (
      <div className={`quick-search ${className}`}>
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
          disabled={!enabled}
          icon={loading ? LoadingIcon : Icon}
          type="text"
          value={value}
          componentRef={inputRef}
          placeholder={placeholder}
          onChange={({ target: { value = '' } }) => setValue(value)}
        />
        <div
          css={`
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
                    results.map(({ primaryKey, result, matchedString }) => (
                      <div
                        key={result}
                        className={`quick-search-result ${css`
                          cursor: pointer;
                        `}`}
                        onClick={() => {
                          setValue('');
                          if (
                            !currentValues({
                              sqon,
                              primaryKeyField,
                            })?.includes(primaryKey)
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
                              highlightText={matchedString}
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
    )}
=======
    }) =>
      enabled ? (
        <div className={`quick-search ${className}`}>
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
            icon={loading ? LoadingIcon : Icon}
            type="text"
            value={value}
            componentRef={inputRef}
            placeholder={placeholder}
            onChange={({ target: { value } }) => setValue(value || '')}
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
                      results.map(({ primaryKey, result, matchedString }) => (
                        <div
                          key={result}
                          className={`quick-search-result ${css`
                            cursor: pointer;
                          `}`}
                          onClick={() => {
                            setValue('');
                            if (
                              !currentValues({
                                sqon,
                                primaryKeyField,
                              })?.includes(primaryKey)
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
                                highlightText={matchedString}
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
      )
    }
>>>>>>> 4235363... :art: moved quick search query into its own component
  />
);

export default enhance(QuickSearch);
