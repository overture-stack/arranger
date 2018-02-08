import React, { Component } from 'react';
import { orderBy } from 'lodash';
import './AggregationCard.css';
import State from '../State';

const TermAggs = ({
  field = '',
  displayName = 'Unnamed Field',
  buckets = [],
  handleValueClick = () => {},
  isActive = () => {},
  Content = 'div',
  maxTerms = 5,
  collapsible = true,
}) => {
  const dotField = field.replace(/__/g, '.');

  return (
    <State
      initial={{ isCollapsed: false, showingMore: false }}
      render={({ update, isCollapsed, showingMore }) => (
        <div className="test-term-aggregation aggregation-card">
          <div
            className={`title-wrapper ${isCollapsed && 'collapsed'}`}
            onClick={
              collapsible
                ? () => update({ isCollapsed: !isCollapsed })
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
                    key={bucket.name}
                    className="bucket-item"
                    style={{
                      display: 'flex',
                    }}
                    onClick={() => handleValueClick(bucket)}
                    content={{
                      field: dotField,
                      value: bucket.name,
                    }}
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
                        name={`input-${field}-${bucket.name.replace(
                          /\s/g,
                          '-',
                        )}`}
                      />
                      {bucket.name}
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
                  onClick={() => update({ showingMore: !showingMore })}
                >
                  {showingMore ? 'Less' : `${buckets.length - maxTerms} More`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
};

export default TermAggs;
