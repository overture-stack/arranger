import React from 'react';
import { get } from 'lodash';

import { AggsState } from '../Aggs';
import Query from '../Query';
import { accessor, underscoreField } from './Stats';

const CombinedStatsQuery = ({
  api,
  projectId,
  graphqlField,
  sqon,
  stats,
  render,
}) => (
  <AggsState
    {...{ api, projectId, graphqlField }}
    render={({ aggs }) => {
      const decoratedStats = stats.map((s, i) => ({
        key: `q${i}`,
        formatResult: x => x,
        aggsField: aggs.find(x => x.field === underscoreField(s.field)),
        ...s,
      }));
      return (
        <Query
          {...{ api, projectId, graphqlField }}
          renderError
          name={`CombinedStatsQuery`}
          shouldFetch={aggs.length}
          variables={{ sqon }}
          query={`
            query($sqon: JSON) {
              data: ${graphqlField} {
                ${decoratedStats.map(
                  ({ key, aggsField, isRoot }) =>
                    `${key}: ${
                      isRoot ? `hits` : `aggregations`
                    }(filters: $sqon) {
                      ${isRoot ? `total` : aggsField?.query || ``}
                    }
                    `,
                )}
              }
            }
          `}
          render={({ data, loading }) =>
            render({
              loading,
              data: decoratedStats.reduce(
                (obj, x) => ({
                  ...obj,
                  [x.label]: x.formatResult(
                    get(
                      data,
                      `data.${x.key}.${x.isRoot ? `total` : accessor(x)}`,
                      null,
                    ),
                  ),
                }),
                {},
              ),
            })
          }
        />
      );
    }}
  />
);

export default CombinedStatsQuery;
