import React from 'react';
import { stringify } from 'query-string';
import { capitalize } from 'lodash';
import { inCurrentFilters } from '../SQONView/utils';
import Location from '../Location';
import TermAgg from './TermAgg';
import AggsQuery from './AggsQuery';

/*
handleFieldClick={d => {
  // history.push({
  //   search: stringify({
  //     filters: JSON.stringify({
  //       op: 'and',
  //       content: [
  //         {
  //           op: 'in',
  //           content: {
  //             field: d.field,
  //             value: [d.value],
  //           },
  //         },
  //       ],
  //     }),
  //   }),
  // });
}}
*/

export default ({ index, aggs = {}, ...props }) =>
  aggs.map(agg => (
    // TODO: switch on agg type
    <TermAgg
      key={agg.field}
      {...agg}
      {...props}
      // isActive={d =>
      //   inCurrentFilters({
      //     key: d.value,
      //     dotField: d.field,
      //     currentFilters: (search.filters || {}).content,
      //   })
      // }
    />
  ));
