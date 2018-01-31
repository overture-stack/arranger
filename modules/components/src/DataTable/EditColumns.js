import React, { Fragment } from 'react';
import { noop } from 'lodash';
import State from '../State';

export default ({ state = {}, handleChange = noop }) => (
  <State
    initial={{ searchTerm: '' }}
    render={({ searchTerm, update }) => {
      console.log(state);
      return (
        <Fragment>
          <div className="edit-columns-filter">
            <label>filter: </label>
            <input
              type="text"
              value={searchTerm}
              onChange={e => update({ searchTerm: e.target.value })}
            />
          </div>
          {state.columns?.filter(x => x.field.includes(searchTerm)).map(x => (
            <div key={x.field} className="edit-column">
              <div>field: {x.field}</div>
              <div>
                show:
                <input
                  type="checkbox"
                  checked={x.show}
                  onChange={() =>
                    handleChange({
                      field: x.field,
                      key: 'show',
                      value: !x.show,
                    })
                  }
                />
              </div>
              <div>
                active:
                <input
                  type="checkbox"
                  checked={x.canChangeShow}
                  onChange={() =>
                    handleChange({
                      field: x.field,
                      key: 'canChangeShow',
                      value: !x.canChangeShow,
                    })
                  }
                />
              </div>
              <div>type: {x.type}</div>
            </div>
          ))}
        </Fragment>
      );
    }}
  />
);
