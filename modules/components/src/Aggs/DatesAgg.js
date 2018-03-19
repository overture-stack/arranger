import React, { Component } from 'react';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import moment from 'moment';
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
      focusedInput: null,
      selectedRange: {
        startDate: null,
        endDate: null,
      },
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
    const { isCollapsed, focusedInput } = this.state;

    const getInitialVisibleMonth = () => {
      console.log('focusedInput: ', focusedInput);
      return (
        focusedInput &&
        (focusedInput === 'startDate'
          ? this.state.selectedRange.startDate
          : this.state.selectedRange.endDate)
      );
    };

    console.log(this.state.selectedRange);

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
          initialVisibleMonth={() => moment()}
          startDate={this.state.selectedRange.startDate}
          endDate={this.state.selectedRange.endDate}
          onDatesChange={({ startDate, endDate }) =>
            this.setState({ selectedRange: { startDate, endDate } })
          }
        />
      </div>
    );
  }
}

export default DatesAgg;
