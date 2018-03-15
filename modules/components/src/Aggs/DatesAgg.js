import React, { Component } from 'react';
import InputRange from 'react-input-range';
import convert from 'convert-units';
import _ from 'lodash';

import { replaceSQON } from '../SQONView/utils';

import './AggregationCard.css';

import State from '../State';

class DatesAgg extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    let {
      field = '',
      Content = 'div',
      displayName = 'Unnamed Field',
      buckets = [],
      collapsible = true,
      handleChange = () => {},
    } = this.props;
    return (
      <State
        initial={{ isCollapsed: false }}
        render={({ update, isCollapsed }) => (
          <div className="aggregation-card">
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
            put stuff here!!!!
          </div>
        )}
      />
    );
  }
}

export default DatesAgg;
