import React, { Component } from 'react';
import { orderBy } from 'lodash';
import './TermAgg.css';

const TermAggs = ({
  field = '',
  displayName = 'Unnamed Field',
  buckets = [],
  handleValueClick = () => {},
  isActive = () => {},
  isCollapsed = false,
  Content = 'div',
  onArrowClick = () => {},
}) => {
  const dotField = field.replace(/__/g, '.');

  return (
    <div className="test-term-aggregation aggregation-card">
      <div
        className={`title-wrapper ${isCollapsed && 'collapsed'}`}
        onClick={onArrowClick}
      >
        <span className="title">{displayName}</span>
        <span className={`arrow ${isCollapsed && 'collapsed'}`} />
      </div>
      {!isCollapsed && (
        <div className={`bucket ${isCollapsed && 'collapsed'}`}>
          {orderBy(buckets, 'doc_count', 'desc')
            // .slice(0, props.showingMore ? Infinity : 5)
            .map(b => ({ ...b, name: b.key_as_string || b.key }))
            .map(bucket => (
              <Content
                key={bucket.name}
                className="bucket-item"
                style={{
                  display: 'flex',
                }}
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
                    name={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
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
        </div>
      )}
    </div>
  );
};

class CollapsibleTermAgg extends Component {
  state = {
    isCollapsed: false,
  };
  render() {
    return (
      <TermAggs
        {...this.props}
        isCollapsed={this.state.isCollapsed}
        onArrowClick={() =>
          this.setState({ isCollapsed: !this.state.isCollapsed })
        }
      />
    );
  }
}

export default CollapsibleTermAgg;
