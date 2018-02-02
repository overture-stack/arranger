import React from 'react';
import { compose } from 'recompose';
import { injectState } from 'freactal';

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

const enhance = compose(injectState);

const Portal = ({
  state: { arranger: { projectId, index, sqon, streamData, fetchData } },
  effects: { setSQON },
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
                                setSQON(
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
            <Value onClick={() => setSQON(nextSQON)} {...props}>
              {value}
            </Value>
          )}
          Clear={({ nextSQON }) => (
            <Bubble className="sqon-clear" onClick={() => setSQON(nextSQON)}>
              Clear
            </Bubble>
          )}
        />
        <ColumnsState
          projectId={projectId}
          index={index}
          render={columnState => {
            return (
              <DataTable
                sqon={sqon}
                config={columnState.state}
                setSQON={setSQON}
                onSelectionChange={console.log('selection changed')}
                streamData={streamData}
                fetchData={fetchData}
              />
            );
          }}
        />
      </div>
    </div>
  );
};

export default enhance(Portal);
