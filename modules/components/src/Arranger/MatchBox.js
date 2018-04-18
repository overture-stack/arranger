import React from 'react';
import { capitalize, difference, uniq } from 'lodash';
import { compose, withState, withHandlers } from 'recompose';
import { css } from 'emotion';
import pluralize from 'pluralize';

import Input from '../Input';
import Tabs, { TabsTable } from '../Tabs';
import Select, { Option } from '../Select';
import { MatchBoxState } from '../MatchBox';
import QuickSearchQuery from './QuickSearch/QuickSearchQuery';
import QuickSearchFieldsQuery from './QuickSearch/QuickSearchFieldsQuery';

const enhance = compose(
  withState('entityPath', 'setEntityPath', false),
  withState('searchText', 'setSearchText', ''),
  withHandlers({
    onEntityChange: ({ setEntityPath }) => ({ target: { value } }) =>
      setEntityPath(value),
    onTextChange: ({ setSearchText }) => ({ target: { value } }) =>
      setSearchText(value),
    onFileUpload: ({ setSearchText }) => async ({ target }) => {
      let files = [];
      for (let i = 0; i < target.files.length; i++)
        files = [...files, target.files[i]];
      const contents = await Promise.all(
        files.map(
          f =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = e => reject(e);
              reader.readAsText(f);
            }),
        ),
      );
      setSearchText((contents || []).reduce((str, c) => `${str}${c}\n`, ``));
    },
  }),
);

const inputRef = React.createRef();
const MatchBox = ({
  matchHeaderText,
  instructionText = `Type or copy-and-paste a list of comma delimited identifiers, or choose a file of identifiers to upload`,
  placeholderText = `e.g. Id\ne.g. Id`,
  entitySelectText = `Select the entity to upload`,
  entitySelectPlaceholder = `Select an Entity`,
  ButtonComponent = 'button',
  children,
  entityPath,
  searchText,
  searchTextParts,
  onTextChange,
  onFileUpload,
  onEntityChange,
  ...props
}) => (
  <div className="match-box">
    <MatchBoxState
      {...props}
      render={({ activeFields, a = console.log(activeFields) }) => (
        <div>
          <div className="match-box-select-entity-form">
            <div>{entitySelectText}</div>
            <Select onChange={onEntityChange}>
              <Option value={false}>{entitySelectPlaceholder}</Option>
              {activeFields.map(({ displayName, field }) => (
                <Option key={field} value={field}>
                  {capitalize(displayName)}
                </Option>
              ))}
            </Select>
          </div>
          <div className="match-box-id-form">
            <div>{instructionText}</div>
            <Input
              disabled={typeof entityPath !== 'string'}
              Component="textarea"
              placeholder={placeholderText}
              value={searchText}
              onChange={onTextChange}
            />
            <div
              className={css`
                display: flex;
                justify-content: flex-end;
              `}
            >
              <input
                type="file"
                className={css`
                  position: absolute;
                  top: -10000px;
                  left: 0px;
                `}
                accept=".tsv,.csv,text/*"
                ref={inputRef}
                multiple
                onChange={onFileUpload}
              />
              <ButtonComponent
                disabled={typeof entityPath !== 'string'}
                type="submit"
                onClick={() => inputRef.current.click()}
              >
                Browse
              </ButtonComponent>
            </div>
          </div>
          {/* <QuickSearchQuery
            exact
            size={9999999}
            {...props}
            searchText={searchText}
            primaryKeyField={primaryKeyField}
            quickSearchFields={quickSearchFields?.filter(
              x => x.nestedPath === entityPath,
            )}
            mapResults={({ results, searchTextParts }) => ({
              uniqueIds: uniq(results.map(x => x.primaryKey)),
              unmatchedKeys: difference(
                searchTextParts,
                results.map(x => x.input),
              ),
            })}
            render={({
              results,
              uniqueIds,
              unmatchedKeys,
              a = console.log(results),
            }) => (
              <div className="match-box-results-table">
                {matchHeaderText}
                <Tabs
                  tabs={[
                    {
                      key: 'matched',
                      title: `Matched (${uniqueIds.length})`,
                      content: (
                        <TabsTable
                          columns={[
                            {
                              Header: 'Input Id',
                              accessor: 'inputId',
                            },
                            {
                              Header: `Matched Entity`,
                              accessor: 'matchedEntity',
                            },
                            { Header: 'Entity Id', accessor: 'entityId' },
                          ]}
                          data={
                            results.length
                              ? results.map(({ input, entity, result }) => ({
                                  inputId: input,
                                  matchedEntity: pluralize(entity, 1),
                                  entityId: result,
                                }))
                              : [
                                  {
                                    inputId: '',
                                    matchedEntity: '',
                                    entityId: '',
                                  },
                                ]
                          }
                        />
                      ),
                    },
                    {
                      key: 'unmatched',
                      title: `Unmatched (${unmatchedKeys.length})`,
                      content: (
                        <TabsTable
                          columns={[
                            {
                              Header: 'Input Id',
                              accessor: 'inputId',
                            },
                          ]}
                          data={
                            unmatchedKeys?.length
                              ? unmatchedKeys.map(x => ({ inputId: x }))
                              : [{ inputId: '' }]
                          }
                        />
                      ),
                    },
                  ]}
                />
                {children({ ids: uniqueIds })}
              </div>
            )}
          /> */}
        </div>
      )}
    />
  </div>
);

export default enhance(MatchBox);
