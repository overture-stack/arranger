import React from 'react';
import { css } from 'emotion';
import { uniq } from 'lodash';
import { compose, withState } from 'recompose';
import SearchIcon from 'react-icons/lib/fa/search';

import { Value as SQONBubble } from '../../SQONView';
import { currentFieldValue, toggleSQON } from '../../SQONView/utils';
import TextInput from '../../Input';
import TextHighlight from '../../TextHighlight';
import QuickSearchQuery from './QuickSearchQuery';
import QuickSearchFieldsQuery from './QuickSearchFieldsQuery';

const currentValues = ({ sqon, primaryKeyField }) =>
  currentFieldValue({ sqon, dotField: primaryKeyField?.field, op: 'in' });

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
  className,
  sqon,
  setSQON,
  value,
  setValue,
  placeholder = 'Quick Search',
  Icon = <SearchIcon />,
  LoadingIcon = <SearchIcon />,
  PinnedValueComponent = SQONBubble,
  ...props
}) => (
  <QuickSearchFieldsQuery
    {...props}
    render={({ primaryKeyField, enabled, ...quickSearchFields }) => (
      <QuickSearchQuery
        {...props}
        {...{ primaryKeyField, ...quickSearchFields }}
        searchText={value}
        mapResults={({ resultsByEntity }) => ({
          searchResultIndexLookup:
            resultsByEntity &&
            uniq(resultsByEntity.map(x => x.entity)).reduce(
              (obj, x, i) => ({ ...obj, [x]: i }),
              {},
            ),
        })}
        render={({
          results: searchResults,
          loading,
          searchResultIndexLookup,
        }) => (
          <div className={`quick-search ${className}`}>
            <div className="quick-search-pinned-values">
              {currentValues({ sqon, primaryKeyField })?.map(primaryKey => (
                <div className="quick-search-pinned-value">
                  <PinnedValueComponent
                    onClick={() =>
                      toggleValue({
                        sqon,
                        setSQON,
                        primaryKeyField,
                        primaryKey,
                      })
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
              onChange={({ target: { value } }) => setValue(value || '')}
            />

            <div
              className={css`
                position: relative;
              `}
            >
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
                {searchResults?.map(
                  ({
                    entity,
                    result,
                    primaryKey,
                    input,
                    index = searchResultIndexLookup[entity] % 5 + 1,
                  }) => (
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
                        <div>{entity.slice(0, 2).toUpperCase()}</div>
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
                            highlightText={input}
                            content={result}
                          />
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      />
    )}
  />
);

export default enhance(QuickSearch);
