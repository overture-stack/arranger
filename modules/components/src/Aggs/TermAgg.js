import React from 'react';
import { orderBy } from 'lodash';
import './AggregationCard.css';
import State from '../State';
import { toggleSQON } from '../SQONView/utils';
import { truncate } from 'lodash';
import AggsWrapper from './AggsWrapper';

class TermAggs extends React.Component {
  // needs ref

  state = { showingMore: false };

  render() {
    const {
      field = '',
      displayName = 'Unnamed Field',
      buckets = [],
      handleValueClick = () => {},
      isActive = () => {},
      Content = 'div',
      maxTerms = 5,
      collapsible = true,
      constructEntryId = ({ value }) => value,
      valueCharacterLimit,
      observableValueInFocus = null,
    } = this.props;
    const { showingMore } = this.state;
    const dotField = field.replace(/__/g, '.');
    return (
      <AggsWrapper {...{ displayName }}>
        <div className={`bucket`}>
          {orderBy(buckets, 'doc_count', 'desc')
            .slice(0, showingMore ? Infinity : maxTerms)
            .map(b => ({ ...b, name: b.key_as_string || b.key }))
            .map(bucket => (
              <Content
                ref={el =>
                  (this.refs = {
                    ...this.refs,
                    [constructEntryId({ value: bucket.name })]: el,
                  })
                }
                id={constructEntryId({ value: bucket.name })}
                key={bucket.name}
                className="bucket-item"
                style={{
                  display: 'flex',
                }}
                content={{
                  field: dotField,
                  value: bucket.name,
                }}
                onClick={() =>
                  handleValueClick({
                    bucket,
                    generateNextSQON: sqon =>
                      toggleSQON(
                        {
                          op: 'and',
                          content: [
                            {
                              op: 'in',
                              content: {
                                field: dotField,
                                value: [].concat(bucket.name || []),
                              },
                            },
                          ],
                        },
                        sqon,
                      ),
                  })
                }
              >
                <span className="bucket-link" merge="toggle">
                  <input
                    readOnly
                    type="checkbox"
                    style={{
                      pointerEvents: 'none',
                      marginRight: '5px',
                      flexShrink: 0,
                      verticalAlign: 'middle',
                    }}
                    checked={isActive({
                      field: dotField,
                      value: bucket.name,
                    })}
                    id={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                    name={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                  />
                  {truncate(bucket.name, {
                    length: valueCharacterLimit || Infinity,
                  })}
                  {/* <OverflowTooltippedLabel
                          htmlFor={`input-${props.title}-${bucket.name.replace(
                            /\s/g,
                            '-',
                          )}`}
                          style={{
                            marginLeft: '0.3rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          {bucket.name}
                        </OverflowTooltippedLabel> */}
                </span>
                {bucket.doc_count && (
                  <span className="bucket-count">
                    {bucket.doc_count.toLocaleString()}
                  </span>
                )}
              </Content>
            ))}

          {buckets.length > maxTerms && (
            <div
              className={`showMore-wrapper ${showingMore ? 'less' : 'more'}`}
              onClick={() => this.setState({ showingMore: !showingMore })}
            >
              {showingMore ? 'Less' : `${buckets.length - maxTerms} More`}
            </div>
          )}
        </div>
      </AggsWrapper>
    );
  }
}

export default TermAggs;
