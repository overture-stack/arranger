import React from 'react';
import { startCase, sortBy } from 'lodash';
import convert from 'convert-units';
import State from '../../State';
import api from '../../utils/api';
import { FancyLabel } from '../uiComponents';

const FIELD_TYPES = [
  'keyword',
  'nested',
  'integer',
  'float',
  'id',
  'object',
  'boolean',
  'date',
  'long',
  'text',
];

export default ({
  projectId,
  graphqlField,
  filterText,
  activeField,
  index,
  eshost,
  fieldsTotal,
  fields,
  setActiveField,
  setFields,
}) => {
  return (
    <div
      css={`
        display: flex;
      `}
    >
      <section>
        <div style={{ padding: 5 }}>
          <FancyLabel className="projects">FIELDS ({fieldsTotal})</FancyLabel>
        </div>
        {sortBy(fields, ({ field }) => field)
          .filter(x => x.field.includes(filterText))
          .map(x => (
            <div
              key={x.field}
              className={`field-item ${
                x.field === activeField?.field ? 'active' : ''
              }`}
              onClick={() => {
                setActiveField(x);
              }}
            >
              {x.field}
            </div>
          ))}
      </section>
      <section>
        <div style={{ padding: 5 }}>
          <FancyLabel className="projects">{activeField?.field}</FancyLabel>
        </div>
        {Object.entries(activeField || {})
          .filter(([key]) => key !== 'field')
          .filter(
            ([key]) =>
              key !== 'displayValues' || activeField.type === 'boolean',
          )
          .map(([key, val]) => {
            const updateActiveField = async value => {
              let r = await api({
                endpoint: `/projects/${projectId}/types/${index}/fields/${
                  activeField.field
                }/update`,
                body: { eshost, key, value },
              });
              setActiveField(r.fields.find(x => x.field === activeField.field));
              setFields(r.fields);
            };
            const updateBooleanDisplayValue = k => e =>
              updateActiveField({
                ...val,
                [k]: e.target.value,
              });
            return (
              <div key={key} className="type-container">
                {startCase(key)}:
                {key === 'displayValues' ? (
                  activeField.type === 'boolean' ? (
                    <div>
                      <FancyLabel>Any: </FancyLabel>
                      <input
                        type="text"
                        onChange={updateBooleanDisplayValue('any')}
                        value={val.any}
                      />
                      <FancyLabel>True: </FancyLabel>
                      <input
                        type="text"
                        onChange={updateBooleanDisplayValue('true')}
                        value={val.true}
                      />
                      <FancyLabel>False: </FancyLabel>
                      <input
                        type="text"
                        onChange={updateBooleanDisplayValue('false')}
                        value={val.false}
                      />
                    </div>
                  ) : null
                ) : key === 'unit' ? (
                  <State
                    initial={{
                      val,
                      measure: val ? convert().describe(val).measure : '',
                    }}
                    val={val}
                    onReceiveProps={({ props, state, update }) => {
                      if (props.val !== state.val) {
                        update({
                          val,
                          measure: val ? convert().describe(val).measure : '',
                        });
                      }
                    }}
                    render={({ measure, update }) => (
                      <div>
                        <select
                          value={measure}
                          onChange={e =>
                            update({
                              measure: e.target.value,
                            })
                          }
                        >
                          {['', ...convert().measures()].map(x => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        {measure && (
                          <select
                            value={val || ''}
                            onChange={e => {
                              update({ val });
                              updateActiveField(e.target.value);
                            }}
                          >
                            {['', ...convert().possibilities(measure)].map(
                              x => <option key={x}>{x}</option>,
                            )}
                          </select>
                        )}
                      </div>
                    )}
                  />
                ) : key === 'type' ? (
                  <select
                    value={val}
                    onChange={e => updateActiveField(e.target.value)}
                  >
                    {FIELD_TYPES.map(type => <option>{type}</option>)}
                  </select>
                ) : typeof val === 'string' ? (
                  <input
                    type="text"
                    value={val}
                    onChange={e => updateActiveField(e.target.value)}
                  />
                ) : (
                  typeof val === 'boolean' && (
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={e => updateActiveField(e.target.checked)}
                    />
                  )
                )}
              </div>
            );
          })}
      </section>
    </div>
  );
};
