import React, { Fragment } from 'react';
import { capitalize, difference, get, uniqBy } from 'lodash';
import { compose, withState, withHandlers } from 'recompose';
import { css } from 'emotion';

import Input from '../Input';
import Tabs, { TabsTable } from '../Tabs';
import { MatchBoxState } from '../MatchBox';
import QuickSearchQuery from './QuickSearch/QuickSearchQuery';
import saveSet from '../utils/saveSet';
import formatNumber from '../utils/formatNumber';
import parseInputFiles from '../utils/parseInputFiles';
import { toggleSQON } from '../SQONView/utils';

const layoutStyle = css`
  &.match-box {
    display: flex;
    flex-direction: column;
    .match-box-results-table {
      display: flex;
      flex-direction: column;
    }
    .tabs {
      display: flex;
      flex-direction: column;
    }
    .tabs .tabs-content {
      display: flex;
      flex-direction: column;
    }
    .tabs .tabs-titles {
      display: block;
    }
    .tabs .tabs-titles .tabs-title {
      float: left;
    }
  }
`;

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
      target: { files },
    }) => {
      setSearchTextLoading(true);
      const contents = await parseInputFiles({ files });
      setSearchText(
        (contents || [])
          .map(f => f.content)
          .reduce((str, c) => `${str}${c}\n`, ``),
      );
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
  matchedTabTitle = `Matched`,
  unmatchedTabTitle = `Unmatched`,
  matchTableColumnHeaders = {
    inputId: `Input Id`,
    matchedEntity: `Matched Entity`,
    entityId: `Entity Id`,
  },
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
  <div className={`match-box ${layoutStyle}`}>
    <MatchBoxState
      {...props}
      render={({
        primaryKeyField,
        activeFields,
        activeField = activeFields.find(x => x.field === activeEntityField),
      }) => (
        <Fragment>
          <div className="match-box-select-entity-form">
            <div className="match-box-entity-select-text">
              {entitySelectText}
            </div>
            <select onChange={onEntityChange}>
              <option value={null}>{entitySelectPlaceholder}</option>
              {activeFields.map(({ field, displayName }) => (
                <option key={field} value={field}>
                  {capitalize(displayName)}
                </option>
              ))}
            </select>
          </div>
          <div className="match-box-id-form">
            <div className="match-box-selection-text">{instructionText}</div>
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
            size={9999999} // TODO: pagination - this will currently choke on large input
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
                      title: `${matchedTabTitle} (${formatNumber(
                        results.length,
                      )})`,
                      content: (
                        <TabsTable
                          columns={['inputId', 'matchedEntity', 'entityId'].map(
                            x => ({
                              Header: matchTableColumnHeaders[x],
                              accessor: x,
                            }),
                          )}
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
                      title: `${unmatchedTabTitle} (${formatNumber(
                        unmatchedKeys.length,
                      )})`,
                      content: (
                        <TabsTable
                          columns={[
                            {
                              Header: matchTableColumnHeaders.inputId,
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
                  saveSet: async ({
                    userId,
                    api,
                    dataPath = 'data.data.saveSet',
                  }) => {
                    const data = get(
                      await saveSet({
                        sqon: quickSearchSqon,
                        type: props.graphqlField,
                        userId,
                        path: primaryKeyField.field,
                        api,
                      }),
                      dataPath,
                    );
                    const nextSQON = toggleSQON(
                      {
                        op: 'and',
                        content: [
                          {
                            op: 'in',
                            content: {
                              field: primaryKeyField?.field,
                              value: [`set_id:${data.setId}`],
                            },
                          },
                        ],
                      },
                      sqon,
                    );
                    setSQON?.(nextSQON);
                    return { ...data, nextSQON };
                  },
                })}
              </div>
            )}
          />
        </Fragment>
      )}
    />
  </div>
);

export default enhance(MatchBox);
