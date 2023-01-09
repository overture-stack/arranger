import React from 'react';
import { css } from '@emotion/react';
import { compose, withState } from 'recompose';
import { FaSearch } from 'react-icons/fa';
import Component from 'react-component-component';

import TextInput from '@/Input';
import { Value as SQONBubble } from '@/SQONViewer';
import { currentFieldValue, toggleSQON } from '@/SQONViewer/utils';
import TextHighlight from '@/TextHighlight';
import internalTranslateSQONValue from '@/utils/translateSQONValue';

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

const DropdownItem = ({
  entityName,
  optionIndex,
  inputValue,
  result,
  primaryKey,
  onMouseDown = () => {},
}) => (
  <div
    className={`quick-search-result ${css`
      cursor: pointer;
    `}`}
    onMouseDown={onMouseDown}
  >
    <div className={`quick-search-result-entity quick-search-result-entity-${optionIndex}`}>
      <div>{entityName.slice(0, 2).toUpperCase()}</div>
    </div>
    <div className="quick-search-result-details">
      <div className="quick-search-result-key">{primaryKey}</div>
      <div className="quick-search-result-value">
        <TextHighlight
          highlightClassName={`quick-search-result-value-highlight ${css`
            font-weight: bold;
          `}`}
          highlightText={inputValue}
          content={result}
        />
      </div>
    </div>
  </div>
);

const inputRef = React.createRef();
const QuickSearch = ({
  className,
  sqon,
  setSQON,
  value,
  setValue,
  searchLowercase = false,
  searchTextDelimiters = ['\\s', ','],
  placeholder = 'Quick Search',
  Icon = FaSearch,
  LoadingIcon = FaSearch,
  PinnedValueComponent = SQONBubble,
  translateSQONValue = (x) => x,
  InputComponent = TextInput,
  DropdownItemComponent = DropdownItem,
  ...props
}) => (
  <QuickSearchFieldsQuery
    {...props}
    render={({
      primaryKeyField,
      enabled,
      quickSearchFields,
      quickSearchEntities,
      entityIndexLookup = quickSearchEntities.reduce((obj, x, i) => ({ ...obj, [x]: i }), {}),
    }) => (
      <QuickSearchQuery
        {...props}
        {...{ primaryKeyField, quickSearchFields }}
        searchLowercase={searchLowercase}
        searchTextDelimiters={searchTextDelimiters}
        searchText={value}
        render={({ results: searchResults, loading }) => (
          <Component initialState={{ dropDownExpanded: false }}>
            {({ state: { dropDownExpanded }, setState }) => {
              const showDropdown = () => setState({ dropDownExpanded: true });
              const hideDropdown = () => setState({ dropDownExpanded: false });
              return (
                <div className={`quick-search ${className}`}>
                  <div className="quick-search-pinned-values">
                    {currentValues({
                      sqon,
                      primaryKeyField,
                    })?.map((primaryKey) => (
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
                          {compose(translateSQONValue, internalTranslateSQONValue)(primaryKey)}
                        </PinnedValueComponent>
                      </div>
                    ))}
                  </div>
                  <InputComponent
                    aria-label={`Quick search`}
                    componentRef={inputRef}
                    disabled={!enabled}
                    leftIcon={{
                      Icon: loading ? LoadingIcon : Icon,
                    }}
                    onBlur={hideDropdown}
                    onChange={({ target: { value } = {} } = {}) => setValue(value || '')}
                    onFocus={showDropdown}
                    placeholder={placeholder}
                    type="text"
                    value={value}
                  />
                  <div
                    className={css`
                      position: relative;
                    `}
                  >
                    {!dropDownExpanded ? null : (
                      <div
                        className={`quick-search-results ${css`
                          position: absolute;
                          top: 0;
                          left: 0;
                          margin: 0;
                          padding: 0;
                          z-index: 1;
                          background: white;
                          width: 100%;
                        `}`}
                      >
                        {searchResults?.map(
                          (
                            {
                              entityName,
                              result,
                              primaryKey,
                              input,
                              index = (entityIndexLookup[entityName] % 5) + 1,
                            },
                            i,
                          ) => (
                            <DropdownItemComponent
                              entityName={entityName}
                              optionIndex={index}
                              primaryKey={primaryKey}
                              key={`${result}-${i}`}
                              aria-label={`${result}-${i}`}
                              result={result}
                              inputValue={input}
                              onMouseDown={() => {
                                // onMouseDown because the input's onBlur would prevent onClick from triggering
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
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          </Component>
        )}
      />
    )}
  />
);

export default enhance(QuickSearch);
