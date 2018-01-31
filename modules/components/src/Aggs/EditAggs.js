import React, { Fragment } from 'react';
import { noop } from 'lodash';
import State from '../State';
import AggsConfigTable from '../Admin/AggsConfigTable';

export default ({ aggs = [], handleChange = noop }) => (
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
        <div
          css={`
            flex-grow: 1
            display: flex;
            flex-direction: column;
            height: calc(100vh - 100px)
          `}
        >
          <AggsConfigTable
            total={aggs.length}
            data={aggs.filter(x => x.field.includes(searchTerm))}
            handleChange={x =>
              handleChange({
                field: x.field,
                key: 'active',
                value: !x.active,
              })
            }
          />
        </div>
      </Fragment>
    )}
  />
);
