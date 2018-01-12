import React from 'react';
import { Route } from 'react-router-dom';
import { parse } from 'query-string';

export default props => (
  <Route>
    {p => {
      let search = parse(p.location.search);
      if (search.filters) search.filters = JSON.parse(search.filters);
      return props.render(search);
    }}
  </Route>
);
