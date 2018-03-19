import React, { Component } from 'react';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import Moment from 'moment';
import {
  DateRangePicker,
  SingleDatePicker,
  DayPickerRangeController,
} from 'react-dates';
import convert from 'convert-units';
import { maxBy, minBy } from 'lodash';

import { inCurrentSQON, replaceSQON, toggleSQON } from '../SQONView/utils';
import './AggregationCard.css';

const dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
const toMoment = dateString => Moment(dateString, dateFormat);
const fromMoment = moment => moment?.format(dateFormat);

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
      displayName = 'Unnamed Field',
      buckets = [],
      collapsible = true,
      handleChange = () => {},
      handleDateChange = () => {},
    } = this.props;
    const { isCollapsed, focusedInput, selectedRange } = this.state;

    const bucketWithMoment = buckets.map(({ key_as_string, ...rest }) => ({
      ...rest,
      key_as_string,
      moment: toMoment(key_as_string),
    }));
    const minBucket = minBy(bucketWithMoment, ({ moment }) => moment.valueOf());
    const maxBucket = maxBy(bucketWithMoment, ({ moment }) => moment.valueOf());

    const getInitialVisibleMonth = () => {
      console.log('focusedInput: ', focusedInput);
      return (
        focusedInput &&
        (focusedInput === 'startDate'
          ? minBucket.moment || Moment()
          : maxBucket.moment || Moment())
      );
    };

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
          initialVisibleMonth={getInitialVisibleMonth}
          startDate={selectedRange.startDate}
          endDate={selectedRange.endDate}
          isOutsideRange={() => false}
          onDatesChange={({ startDate, endDate }) =>
            this.setState({ selectedRange: { startDate, endDate } }, () => {
              handleDateChange({
                generateNextSQON: sqon => {
                  return this.state.selectedRange.startDate &&
                    this.state.selectedRange.endDate
                    ? replaceSQON(
                        {
                          op: 'and',
                          content: [
                            {
                              op: '>=',
                              content: {
                                field,
                                value: fromMoment(
                                  this.state.selectedRange.startDate.startOf(
                                    'day',
                                  ),
                                ),
                              },
                            },
                            {
                              op: '<=',
                              content: {
                                field,
                                value: fromMoment(
                                  this.state.selectedRange.endDate.endOf('day'),
                                ),
                              },
                            },
                          ],
                        },
                        sqon,
                      )
                    : sqon;
                  // return sqon;
                },
              });
            })
          }
          block
        />
      </div>
    );
  }
}

export default DatesAgg;
