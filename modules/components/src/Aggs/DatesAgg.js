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
      focusedInput: '',
      selectedRange: {
        startDate: null,
        endDate: null,
      },
    };
  }

  onDatesChange = ({ startDate, endDate }) => {
    console.log('yo!!!');
    const { field, handleDateChange = () => {} } = this.props;
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

    const getDateFromSqon = dateToGet => sqon =>
      sqon?.content
        ?.filter(({ content: { field: sqonField } }) => {
          return sqonField === field;
        })
        ?.find(({ op }) => op === (dateToGet === 'startDate' ? '>=' : '<='))
        ?.content.value;

    const getRangeToRender = () => {
      const startFromSqon = startDateFromSqon({
        getDateFromSqon: getDateFromSqon('startDate'),
      });
      const endFromSqon = endDateFromSqon({
        getDateFromSqon: getDateFromSqon('endDate'),
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
    };

    const getInitialVisibleMonth = () => {
      console.log('focusedInput: ', focusedInput);
      const rangeToRender = getRangeToRender();
      return (
        focusedInput &&
        (focusedInput === 'startDate'
          ? rangeToRender.startDate || Moment()
          : rangeToRender.endDate || Moment())
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
          numberOfMonths={2}
          focusedInput={this.state.focusedInput}
          onFocusChange={focusedInput => this.setState({ focusedInput })}
          initialVisibleMonth={getInitialVisibleMonth}
          startDate={getRangeToRender().startDate}
          endDate={getRangeToRender().endDate}
          isOutsideRange={() => false}
          onDatesChange={this.onDatesChange}
          keepOpenOnDateSelect
          block
          small
        />
      </div>
    );
  }
}

export default DatesAgg;
