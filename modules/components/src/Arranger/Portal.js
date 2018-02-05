import React from 'react';
import PropTypes from 'prop-types';

import SQONView, { Value, Bubble } from '../SQONView';
import TermAgg from '../Aggs/TermAgg';
import AggsState from '../Aggs/AggsState';
import AggsQuery from '../Aggs/AggsQuery';

import { inCurrentSQON, toggleSQON } from '../SQONView/utils';

import DataTable, { ColumnsState } from '../DataTable';

let defaultSQON = {
  op: 'and',
  content: [],
};

const Portal = ({
  projectId,
  index,
  sqon,
  streamData,
  fetchData,
  onSQONChange,
  style,
}) => {
  return (
    <div style={{ display: 'flex', ...style }}>
      <AggsState
        projectId={projectId}
        index={index}
        render={aggsState => {
          return (
            <AggsQuery
              debounceTime={300}
              projectId={projectId}
              index={index}
              aggs={aggsState.aggs.filter(x => x.active)}
              render={data =>
                data && (
                  <div
                    css={`
                      width: 300px;
                    `}
                  >
                    {aggsState.aggs
                      .filter(x => x.active)
                      .map(agg => ({
                        ...agg,
                        ...data[index].aggregations[agg.field],
                        ...data[index].extended.find(
                          x => x.field === agg.field,
                        ),
                      }))
                      .map(agg => (
                        // TODO: switch on agg type
                        <TermAgg
                          key={agg.field}
                          {...agg}
                          Content={({ content, ...props }) => (
                            <div
                              {...props}
                              onClick={() =>
                                onSQONChange(
                                  toggleSQON(
                                    {
                                      op: 'and',
                                      content: [
                                        {
                                          op: 'in',
                                          content: {
                                            ...content,
                                            value: [].concat(
                                              content.value || [],
                                            ),
                                          },
                                        },
                                      ],
                                    },
                                    sqon || defaultSQON,
                                  ),
                                )
                              }
                            />
                          )}
                          isActive={d =>
                            inCurrentSQON({
                              value: d.value,
                              dotField: d.field,
                              currentSQON: sqon?.content || defaultSQON.content,
                            })
                          }
                        />
                      ))}
                  </div>
                )
              }
            />
          );
        }}
      />
      <div
        css={`
          position: relative;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        `}
      >
        <SQONView
          sqon={sqon || defaultSQON}
          ValueCrumb={({ value, nextSQON, ...props }) => (
            <Value onClick={() => onSQONChange(nextSQON)} {...props}>
              {value}
            </Value>
          )}
          Clear={({ nextSQON }) => (
            <Bubble
              className="sqon-clear"
              onClick={() => onSQONChange(nextSQON)}
            >
              Clear
            </Bubble>
          )}
        />
        <ColumnsState
          projectId={projectId}
          index={index}
          render={({ toggle, state }) => {
            return (
              <DataTable
                sqon={sqon}
                config={state}
                onSQONChange={onSQONChange}
                onColumnsChange={toggle}
                onFilterChange={x => {
                  const mySqon = toggleSQON(
                    {
                      op: 'and',
                      content: [
                        {
                          op: 'filter',
                          content: {
                            fields: state.columns
                              .filter(
                                x =>
                                  ['text', 'keyword'].includes(
                                    x.extendedType,
                                  ) && x.show,
                              )
                              .map(x => x.field),
                            value: x,
                          },
                        },
                      ],
                    },
                    sqon || defaultSQON,
                  );
                  console.log(`SQON`, JSON.stringify(mySqon, null, 2));
                }}
                onSelectionChange={console.log('selection changed')}
                streamData={streamData}
                fetchData={fetchData(projectId)}
              />
            );
          }}
        />
      </div>
    </div>
  );
};

Portal.contextTypes = { arranger: PropTypes.object };

export default Portal;
