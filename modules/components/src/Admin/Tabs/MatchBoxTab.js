import React from 'react';
import Component from 'react-component-component';

import { MatchBoxState } from '../../MatchBox';

export default ({ projectId, graphqlField }) => (
  <Component initialState={{ activeFieldField: null }}>
    {({ state: { activeFieldField }, setState }) => (
      <MatchBoxState
        projectId={projectId}
        graphqlField={graphqlField}
        render={({
          extended,
          matchBoxState,
          update,
          activeField = matchBoxState.find(x => x.field === activeFieldField),
        }) => {
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              <section
                css={`
                  flex-shrink: 0;
                `}
              >
                {matchBoxState.map(x => (
                  <div
                    css={`
                      cursor: pointer;
                    `}
                    onClick={() => setState({ activeFieldField: x.field })}
                  >
                    {x.isActive ? <span>✓</span> : <span>✗</span>}
                    {x.isActive ? x.displayName : x.field || x.displayName}
                  </div>
                ))}
              </section>
              {activeField && (
                <section>
                  <div>
                    <label>Field: </label>
                    <span>{activeField.field}</span>
                  </div>
                  <div>
                    <label>Display Name: </label>
                    <input
                      type="text"
                      placeholder="Display Name"
                      onChange={({ target: { value } }) =>
                        update({
                          field: activeField.field,
                          key: 'displayName',
                          value,
                        })
                      }
                      value={activeField.displayName}
                    />
                  </div>
                  <div>
                    <label>Active: </label>
                    <input
                      type="checkbox"
                      checked={activeField.isActive}
                      onChange={({ target: { checked } }) =>
                        update({
                          field: activeField.field,
                          key: 'isActive',
                          value: checked,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label>Key Field:</label>
                    <select
                      value={activeField.keyField}
                      onChange={({ target: { value } }) =>
                        update({
                          field: activeField.field,
                          key: 'keyField',
                          value,
                        })
                      }
                    >
                      <option value="" />
                      {extended
                        .filter(
                          x =>
                            activeField.field.length
                              ? x.field !== activeField.field &&
                                x.field.includes('.') &&
                                !x.field
                                  .replace(activeField.field, '')
                                  .slice(1)
                                  .includes('.')
                              : !x.field.includes('.'),
                        )
                        .map(x => <option value={x.field}>{x.field}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Search Fields:</label>
                    <select
                      value={''}
                      onChange={({ target: { value } }) =>
                        update({
                          field: activeField.field,
                          key: 'searchFields',
                          value: [...activeField.searchFields, value],
                        })
                      }
                    >
                      <option value={''} />
                      {extended
                        .filter(
                          x =>
                            !activeField.field.length ||
                            x.field.includes(activeField.field),
                        )
                        .map(x => <option value={x.field}>{x.field}</option>)}
                    </select>
                    {activeField.searchFields.map(x => (
                      <div>
                        <span
                          css={`
                            cursor: pointer;
                          `}
                          onClick={() =>
                            update({
                              field: activeField.field,
                              key: 'searchFields',
                              value: activeField.searchFields.filter(
                                y => y !== x,
                              ),
                            })
                          }
                        >
                          🔥
                        </span>
                        {x}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        }}
      />
    )}
  </Component>
);
