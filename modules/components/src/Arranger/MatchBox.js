import React from 'react';
import { capitalize, difference, uniqBy } from 'lodash';
import { compose, withState, withHandlers } from 'recompose';
import { css } from 'emotion';

import Input from '../Input';
import Tabs, { TabsTable } from '../Tabs';
import Select, { Option } from '../Select';
import { MatchBoxState } from '../MatchBox';
import QuickSearchQuery from './QuickSearch/QuickSearchQuery';
import saveSet from '../utils/saveSet';
import { toggleSQON } from '../SQONView/utils';

const enhance = compose(
  withState('activeEntityField', 'setActiveEntityField', null),
  withState('searchTextLoading', 'setSearchTextLoading', false),
  withState('searchText', 'setSearchText', ''),
  withHandlers({
    onEntityChange: ({ setActiveEntityField }) => ({ target: { value } }) =>
      setActiveEntityField(value),
    onTextChange: ({ setSearchText }) => ({ target: { value } }) =>
      setSearchText(value),
    onFileUpload: ({ setSearchText, setSearchTextLoading }) => async ({
      target,
    }) => {
      setSearchTextLoading(true);
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
      setSearchTextLoading(false);
    },
  }),
);

const inputRef = React.createRef();
const MatchBox = ({
  sqon,
  setSQON,
  matchHeaderText,
  instructionText = `Type or copy-and-paste a list of comma delimited identifiers, or choose a file of identifiers to upload`,
  placeholderText = `e.g. Id\ne.g. Id`,
  entitySelectText = `Select the entity to upload`,
  entitySelectPlaceholder = `Select an Entity`,
  browseButtonText = `Browse`,
  ButtonComponent = 'button',
  LoadingComponent = <div>...</div>,
  children,
  searchText,
  searchTextParts,
  searchTextLoading,
  onTextChange,
  onFileUpload,
  onEntityChange,
  activeEntityField,
  ...props
}) => (
  <div className="match-box">
    <MatchBoxState
      {...props}
      render={({
        primaryKeyField,
        activeFields,
        activeField = activeFields.find(x => x.field === activeEntityField),
      }) => (
        <div>
          <div className="match-box-select-entity-form">
            <div>{entitySelectText}</div>
            <Select onChange={onEntityChange}>
              <Option value={null}>{entitySelectPlaceholder}</Option>
              {activeFields.map(({ field, displayName }) => (
                <Option key={field} value={field}>
                  {capitalize(displayName)}
                </Option>
              ))}
            </Select>
          </div>
          <div className="match-box-id-form">
            <div>{instructionText}</div>
            <Input
              disabled={!activeField}
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
                disabled={!activeField}
                type="submit"
                onClick={() => inputRef.current.click()}
              >
                {searchTextLoading ? LoadingComponent : browseButtonText}
              </ButtonComponent>
            </div>
          </div>
          <QuickSearchQuery
            exact
            size={9999999}
            {...props}
            searchText={searchText}
            primaryKeyField={activeField?.keyField}
            quickSearchFields={activeField?.searchFields}
            mapResults={({ results, searchTextParts }) => ({
              results: uniqBy(results, 'primaryKey'),
              unmatchedKeys: difference(
                searchTextParts,
                results.map(x => x.input),
              ),
            })}
            render={({ results, unmatchedKeys, sqon: quickSearchSqon }) => (
              <div className="match-box-results-table">
                {matchHeaderText}
                <Tabs
                  tabs={[
                    {
                      key: 'matched',
                      title: `Matched (${results.length})`,
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
                              ? results.map(
                                  ({ input, entityName, primaryKey }) => ({
                                    inputId: input,
                                    matchedEntity: entityName,
                                    entityId: primaryKey,
                                  }),
                                )
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
                {children({
                  hasResults: results?.length,
                  saveSet: async ({ userId, api }) => {
                    const { data: { data: { saveSet: data } } } = await saveSet(
                      {
                        sqon: quickSearchSqon,
                        type: props.graphqlField,
                        userId,
                        path: primaryKeyField.field,
                        api,
                      },
                    );
                    if (setSQON) {
                      setSQON(
                        toggleSQON(
                          {
                            op: 'and',
                            content: [
                              {
                                op: 'in',
                                content: {
                                  field: primaryKeyField?.field,
                                  value: [].concat(
                                    `set_id:${data.setId}` || [],
                                  ),
                                },
                              },
                            ],
                          },
                          sqon,
                        ),
                      );
                    }
                    return data;
                  },
                })}
              </div>
            )}
          />
        </div>
      )}
    />
  </div>
);

export default enhance(MatchBox);
