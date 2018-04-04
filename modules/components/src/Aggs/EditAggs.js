import React from 'react';
import { noop } from 'lodash';
import State from '../State';
import AggsConfigTable from '../Admin/AggsConfigTable';

export default ({ aggs = [], handleChange = noop }) => (
  <State
    initial={{ searchTerm: '' }}
    render={({ searchTerm, update }) => (
      <AggsConfigTable
        total={aggs.length}
        data={aggs.filter(x => x.field.includes(searchTerm))}
        onFilterChange={searchTerm => update({ searchTerm })}
        handleChange={x =>
          handleChange({
            field: x.row.field,
            key: x.key,
            value: typeof x.value === 'undefined' ? !x.row[x.key] : x.value,
          })
        }
      />
    )}
  />
);
