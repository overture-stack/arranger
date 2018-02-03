import React from 'react';
import { compose } from 'recompose';
import { injectState } from 'freactal';

import TermAgg from '../Aggs/TermAgg';
import AggsState from '../Aggs/AggsState';
import AggsQuery from '../Aggs/AggsQuery';
import { inCurrentSQON, toggleSQON } from '../SQONView/utils';

const enhance = compose(injectState);

let defaultSQON = {
  op: 'and',
  content: [],
};

const Aggregations = ({
  effects: { setSQON },
  state: { arranger: { sqon, projectId, index } },
}) => {
  return (
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
                      ...data[index].extended.find(x => x.field === agg.field),
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
                                          value: [].concat(content.value || []),
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
  );
};

export default enhance(Aggregations);
