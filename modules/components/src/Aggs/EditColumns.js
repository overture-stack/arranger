import React, { Fragment } from 'react';
import { noop } from 'lodash';
import State from '../State';

export default ({ aggs = {}, handleChange = noop }) => (
  <State
    initial={{ searchTerm: '' }}
    render={({ searchTerm, update }) => (
      <Fragment>
        <div className="edit-aggs-filter">
          <label>filter: </label>
          <input
            type="text"
            value={searchTerm}
            onChange={e => update({ searchTerm: e.target.value })}
          />
        </div>
        {aggs.columns?.filter(x => x.field.includes(searchTerm)).map(x => (
          <div key={x.field} className="edit-agg">
            <div>field: {x.field}</div>
            <div>
              active:
              <input
                type="checkbox"
                checked={x.show}
                onClick={() =>
                  handleChange({
                    field: x.field,
                    key: 'show',
                    value: !x.show,
                  })
                }
              />
            </div>
            <div>type: {x.type}</div>
          </div>
        ))}
      </Fragment>
    )}
  />
);
