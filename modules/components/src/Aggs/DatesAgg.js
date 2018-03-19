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
import { maxBy, minBy, debounce } from 'lodash';

import {
  inCurrentSQON,
  replaceSQON,
  toggleSQON,
  removeSQON,
} from '../SQONView/utils';
import './AggregationCard.css';

const dateFormat = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
const toMoment = dateString => Moment(dateString, dateFormat);
const fromMoment = moment => moment?.format(dateFormat);

class DatesAgg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isCollapsed: false,
      focusedInput: 'startDate',
      selectedRange: {
        startDate: null,
        endDate: null,
      },
    };
  }

  onDatesChange = ({ startDate, endDate }) => {
    console.log(startDate === this.state.selectedRange.startDate);
    const {
      field,
      handleDateChange = () => {},
      handleClearClick = () => {},
    } = this.props;
    if (!startDate && !endDate) {
      console.log('clearing!!!');
      handleClearClick({ generateNextSQON: sqon => removeSQON(field, sqon) });
    } else {
      this.setState({ selectedRange: { startDate, endDate } }, () => {
        if (
          this.state.selectedRange.startDate &&
          this.state.selectedRange.endDate
        ) {
          handleDateChange({
            generateNextSQON: sqon => {
              return replaceSQON(
                {
                  op: 'and',
                  content: [
                    {
                      op: '>=',
                      content: {
                        field,
                        value: fromMoment(
                          this.state.selectedRange.startDate.startOf('day'),
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
              );
            },
          });
          this.setState({ selectedRange: {} });
        }
      });
    }
  };

  getDateFromSqon = dateToGet => sqon => {
    const { field } = this.props;
    return sqon?.content
      ?.filter(({ content: { field: sqonField } }) => {
        return sqonField === field;
      })
      ?.find(({ op }) => op === (dateToGet === 'startDate' ? '>=' : '<='))
      ?.content.value;
  };

  render() {
    let {
      field = '',
      displayName = 'Unnamed Field',
      buckets = [],
      collapsible = true,
      handleChange = () => {},
      handleDateChange = () => {},
      startDateFromSqon = () => null,
      endDateFromSqon = () => null,
    } = this.props;
    const { isCollapsed, focusedInput, selectedRange } = this.state;

    const bucketWithMoment = buckets.map(({ key_as_string, ...rest }) => ({
      ...rest,
      key_as_string,
      moment: toMoment(key_as_string),
    }));
    const minBucket = minBy(bucketWithMoment, ({ moment }) => moment.valueOf());
    const maxBucket = maxBy(bucketWithMoment, ({ moment }) => moment.valueOf());

    const rangeToRender = (() => {
      const startFromSqon = startDateFromSqon({
        getDateFromSqon: this.getDateFromSqon('startDate'),
      });
      const endFromSqon = endDateFromSqon({
        getDateFromSqon: this.getDateFromSqon('endDate'),
      });
      return {
        startDate:
          this.state.selectedRange.startDate ||
          (startFromSqon && toMoment(startFromSqon)) ||
          minBucket?.moment,
        endDate:
          this.state.selectedRange.endDate ||
          (startFromSqon && toMoment(endFromSqon)) ||
          maxBucket?.moment,
      };
    })();

    const getInitialVisibleMonth = () =>
      focusedInput &&
      (focusedInput === 'startDate'
        ? rangeToRender.startDate || Moment()
        : rangeToRender.endDate || Moment());

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
        <div>
          <input value={rangeToRender.startDate.format('YY/MM/DD')} />
          <svg
            class="DayPickerNavigation_svg__horizontal DayPickerNavigation_svg__horizontal_1"
            viewBox="0 0 1000 1000"
          >
            <path d="M694.4 242.4l249.1 249.1c11 11 11 21 0 32L694.4 772.7c-5 5-10 7-16 7s-11-2-16-7c-11-11-11-21 0-32l210.1-210.1H67.1c-13 0-23-10-23-23s10-23 23-23h805.4L662.4 274.5c-21-21.1 11-53.1 32-32.1z" />
          </svg>
          <input value={rangeToRender.endDate.format('YY/MM/DD')} />
        </div>
        <DayPickerRangeController
          numberOfMonths={2}
          focusedInput={this.state.focusedInput}
          onFocusChange={focusedInput => this.setState({ focusedInput })}
          initialVisibleMonth={getInitialVisibleMonth}
          startDate={rangeToRender.startDate}
          endDate={rangeToRender.endDate}
          isOutsideRange={() => false}
          onDatesChange={this.onDatesChange}
          showClearDates
          keepOpenOnDateSelect
          block
          small
        />
      </div>
    );
  }
}

export default DatesAgg;
