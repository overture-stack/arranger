import React from 'react';
import { orderBy } from 'lodash';
import './AggregationCard.css';
import { toggleSQON } from '../SQONView/utils';
import { truncate } from 'lodash';
import Component from 'react-component-component';

class TermAggs extends React.Component {
  // needs ref
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
      ValueInFocus$ = null,
    } = this.props;
    const dotField = field.replace(/__/g, '.');
    return (
      <Component
        didMount={({ setState }) => {
          this.valueFocusSubscription = ValueInFocus$?.subscribe(
            ({ field, value }) => {
              setState({ showingMore: true }, () => {
                const refId = constructEntryId({ value });
                const bucketComponent = this.refs[refId];
                if (bucketComponent) {
                  bucketComponent.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }
              });
            },
          );
        }}
        willUnmount={() => this.valueFocusSubscription?.unsubscribe()}
        initialState={{ isCollapsed: false, showingMore: false }}
      >
        {({ setState, state: { isCollapsed, showingMore } }) => (
          <div className="test-term-aggregation aggregation-card">
            <div
              className={`title-wrapper ${isCollapsed && 'collapsed'}`}
              onClick={
                collapsible
                  ? () => setState({ isCollapsed: !isCollapsed })
                  : () => {}
              }
            >
              <span className="title">{displayName}</span>
              {collapsible && (
                <span className={`arrow ${isCollapsed && 'collapsed'}`} />
              )}
            </div>
            {!isCollapsed && (
              <div className={`bucket ${isCollapsed && 'collapsed'}`}>
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
                          id={`input-${field}-${bucket.name.replace(
                            /\s/g,
                            '-',
                          )}`}
                          name={`input-${field}-${bucket.name.replace(
                            /\s/g,
                            '-',
                          )}`}
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
                      <span className="bucket-count">
                        {bucket.doc_count.toLocaleString()}
                      </span>
                    </Content>
                  ))}

                {buckets.length > maxTerms && (
                  <div
                    className={`showMore-wrapper ${
                      showingMore ? 'less' : 'more'
                    }`}
                    onClick={() => setState({ showingMore: !showingMore })}
                  >
                    {showingMore ? 'Less' : `${buckets.length - maxTerms} More`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Component>
    );
  }
}

export default TermAggs;
