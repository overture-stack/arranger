import React from 'react';
import Spinner from 'react-spinkit';
import { get } from 'lodash';

import Query from '../Query';
import { AggsState } from '../Aggs';

export const underscoreField = str => (str || '').split('.').join('__');

export const accessor = ({ aggsField, dataAccessor }) =>
  `${underscoreField(aggsField?.field)}.${dataAccessor ||
    (aggsField?.isTerms ? `buckets.length` : `stats.count`)}`;

const constructQuery = ({ graphqlField, query, resolver = 'aggregations' }) => `
  query($sqon: JSON) {
    data: ${graphqlField} {
      ${resolver}(
        filters: $sqon
        ${resolver === 'aggregations' ? 'include_missing: false' : ''}
      ) {
        ${query}
      }
    }
  }
`;

const LoadingSpinner = () => (
  <Spinner
    fadeIn="none"
    name="circle"
    color="#a9adc0"
    style={{
      width: 15,
      height: 15,
      marginRight: 9,
    }}
  />
);

const RootQuery = ({ graphqlField, render, sqon, ...props }) => (
  <Query
    {...props}
    shouldFetch
    renderError
    variables={{ sqon }}
    name="StatsRootQuery"
    query={constructQuery({ graphqlField, resolver: 'hits', query: 'total' })}
    render={({ data, error, loading, value }) =>
      render({ loading, value: get(data, `data.hits.total`, '') })
    }
  />
);

const FieldQuery = ({
  aggsState: { aggs },
  field,
  render,
  sqon,
  graphqlField,
  dataAccessor,
  formatResult = x => x,
  aggsField = aggs.find(x => x.field === underscoreField(field)),
  ...props
}) => (
  <Query
    {...props}
    renderError
    name={`StatsFieldQuery`}
    shouldFetch={aggs.length}
    variables={{ sqon }}
    query={constructQuery({ graphqlField, query: aggsField?.query })}
    render={({ data, loading }) =>
      render({
        loading,
        value: formatResult(
          get(
            data,
            `data.aggregations.${accessor({ aggsField, dataAccessor })}`,
            '',
          ),
        ),
      })
    }
  />
);

const Stat = ({
  icon = '',
  label = '',
  isRoot = false,
  LoadingSpinnerComponent,
  QueryComponent = isRoot ? RootQuery : FieldQuery,
  ...props
}) => {
  return (
    <div
      className="stat-container"
      css={`
        display: flex;
        flex-grow: 1;
        justify-content: center;
      `}
    >
      {icon}
      <div className="stat-content">
        <QueryComponent
          {...props}
          render={x => (x.loading ? <LoadingSpinnerComponent /> : x.value)}
        />
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export default ({
  api,
  projectId,
  graphqlField,
  stats,
  className,
  render,
  LoadingSpinnerComponent = LoadingSpinner,
  ...props
}) => (
  <div
    className="stats-container"
    css={`
      display: flex;
      align-items: center;
      ${className};
    `}
  >
    <AggsState
      {...{ api, projectId, graphqlField }}
      render={aggsState =>
        stats.map((stat, i) => (
          <>
            {i > 0 && <div key={i} className="stats-line" />}
            <Stat
              key={stat.label}
              {...{
                aggsState,
                api,
                projectId,
                graphqlField,
                LoadingSpinnerComponent,
              }}
              {...props}
              {...stat}
            />
          </>
        ))
      }
    />
  </div>
);
