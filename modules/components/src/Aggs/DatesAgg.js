import React, { Component } from 'react';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import {
  DateRangePicker,
  SingleDatePicker,
  DayPickerRangeController,
} from 'react-dates';
import convert from 'convert-units';
import _ from 'lodash';

import { replaceSQON } from '../SQONView/utils';
import './AggregationCard.css';

class DatesAgg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isCollapsed: false,
    };
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
    const { isCollapsed } = this.state;
    console.log('buckets: ', buckets);
    return (
      <div className="aggregation-card">
        <div
          className={`title-wrapper ${isCollapsed && 'collapsed'}`}
          onClick={
            collapsible
              ? () => this.setState({ isCollapsed: !isCollapsed })
              : () => {}
          }
        >
          <span className="title">{displayName}</span>
          {collapsible && (
            <span className={`arrow ${isCollapsed && 'collapsed'}`} />
          )}
        </div>
        <DateRangePicker
          focusedInput={this.state.focusedInput}
          onFocusChange={focusedInput => this.setState({ focusedInput })}
        />
      </div>
    );
  }
}

export default DatesAgg;
