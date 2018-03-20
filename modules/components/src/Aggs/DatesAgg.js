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
import { maxBy, minBy, debounce, sumBy, toPairs } from 'lodash';
import { css } from 'emotion';
import { Subject } from 'rxjs';

import {
  inCurrentSQON,
  replaceSQON,
  toggleSQON,
  removeSQON,
} from '../SQONView/utils';
import './AggregationCard.css';

const START_DATE_INPUT = 'startDate';
const END_DATE_INPUT = 'endDate';
const BUCKET_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
const INPUT_DATE_FORMAT = 'YY/MM/DD';

const bucketDateToMoment = dateString => Moment(dateString, BUCKET_DATE_FORMAT);
const momentToBucketDate = moment => moment?.format(BUCKET_DATE_FORMAT);

const inputDateToMoment = dateString => Moment(dateString, INPUT_DATE_FORMAT);
const momentToInputDate = moment => moment?.format(INPUT_DATE_FORMAT);

const inputStyle = css``;

const inputRow = css`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 40px;
`;

class DatesAgg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isCollapsed: false,
      focusedInput: START_DATE_INPUT,
      inputRangeValues: {
        startDate: null,
        endDate: null,
      },
      selectedRange: {
        startDate: null,
        endDate: null,
      },
    };

    // uses observable to bind dom input focus state because doesn't seem the input tag supports any focus prop
    this.$focusedInput = new Subject();
    this.focusInputSubscription = this.$focusedInput.subscribe(focusedInput => {
      this.setState({ focusedInput }, () => {
        if (focusedInput === START_DATE_INPUT) {
          this.startDateInput.focus();
        } else if (focusedInput === END_DATE_INPUT) {
          this.endDateInput.focus();
        } else {
          this.startDateInput.blur();
          this.endDateInput.blur();
        }
      });
    });
  }

  componentWillUnmount() {
    this.focusInputSubscription.unsubscribe();
  }

  onDatesChange = ({ startDate, endDate }) => {
    const {
      field,
      handleDateChange = () => {},
      handleClearClick = () => {},
    } = this.props;
    if (!startDate && !endDate) {
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
                        value: momentToBucketDate(
                          this.state.selectedRange.startDate.startOf('day'),
                        ),
                      },
                    },
                    {
                      op: '<=',
                      content: {
                        field,
                        value: momentToBucketDate(
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
          this.setState({ inputRangeValues: {}, selectedRange: {} });
        }
      });
    }
  };

  isValidInputDateString = dateString =>
    inputDateToMoment(dateString).isValid() &&
    sumBy(dateString?.split('/') || '', str => str?.length === 2) === 3;

  onInputValueChange = ({ value, input }) => {
    const { inputRangeValues, selectedRange } = this.state;
    const { isValidInputDateString } = this;
    const newMoment = inputDateToMoment(value);
    if (!isValidInputDateString(value)) {
      this.setState({
        inputRangeValues: { ...inputRangeValues, [input]: value },
      });
    } else {
      this.onDatesChange({
        ...this.getCalendarRangeToRender(),
        [input]: newMoment,
      });
    }
  };

  getDateFromSqon = dateToGet => sqon => {
    const { field } = this.props;
    return sqon?.content
      ?.filter(({ content: { field: sqonField } }) => {
        return sqonField === field;
      })
      ?.find(({ op }) => op === (dateToGet === START_DATE_INPUT ? '>=' : '<='))
      ?.content.value;
  };

  getCalendarRangeToRender = () => {
    const {
      startDateFromSqon = () => null,
      endDateFromSqon = () => null,
      buckets,
    } = this.props;
    const { selectedRange } = this.state;
    const bucketWithMoment = buckets.map(({ key_as_string, ...rest }) => ({
      ...rest,
      key_as_string,
      moment: bucketDateToMoment(key_as_string),
    }));
    const minBucket = minBy(bucketWithMoment, ({ moment }) => moment.valueOf());
    const maxBucket = maxBy(bucketWithMoment, ({ moment }) => moment.valueOf());

    const startFromSqon = startDateFromSqon({
      getDateFromSqon: this.getDateFromSqon(START_DATE_INPUT),
    });
    const endFromSqon = endDateFromSqon({
      getDateFromSqon: this.getDateFromSqon(END_DATE_INPUT),
    });
    return {
      startDate:
        selectedRange.startDate ||
        (startFromSqon && bucketDateToMoment(startFromSqon)) ||
        minBucket?.moment,
      endDate:
        selectedRange.endDate ||
        (startFromSqon && bucketDateToMoment(endFromSqon)) ||
        maxBucket?.moment,
    };
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
    const {
      isCollapsed,
      focusedInput,
      selectedRange,
      inputRangeValues,
    } = this.state;

    const rangeToRender = this.getCalendarRangeToRender();

    const getInitialVisibleMonth = () =>
      focusedInput &&
      (focusedInput === START_DATE_INPUT
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
        <div
          className={`${inputRow} ${css`
            position: relative;
          `}`}
        >
          <input
            ref={el => (this.startDateInput = el)}
            onFocus={() => this.$focusedInput.next(START_DATE_INPUT)}
            className={`dateInput`}
            value={
              inputRangeValues.startDate
                ? inputRangeValues.startDate
                : momentToInputDate(rangeToRender.startDate)
            }
            onChange={e =>
              this.onInputValueChange({
                value: e.target.value,
                input: START_DATE_INPUT,
              })
            }
          />
          <svg
            class="DayPickerNavigation_svg__horizontal DayPickerNavigation_svg__horizontal_1"
            viewBox="0 0 1000 1000"
          >
            <path d="M694.4 242.4l249.1 249.1c11 11 11 21 0 32L694.4 772.7c-5 5-10 7-16 7s-11-2-16-7c-11-11-11-21 0-32l210.1-210.1H67.1c-13 0-23-10-23-23s10-23 23-23h805.4L662.4 274.5c-21-21.1 11-53.1 32-32.1z" />
          </svg>
          <input
            ref={el => (this.endDateInput = el)}
            onFocus={() => this.$focusedInput.next(END_DATE_INPUT)}
            className={`dateInput`}
            value={
              inputRangeValues.endDate
                ? inputRangeValues.endDate
                : momentToInputDate(rangeToRender.endDate)
            }
            onChange={e =>
              this.onInputValueChange({
                value: e.target.value,
                input: END_DATE_INPUT,
              })
            }
          />
          <div
            className={css`
              position: absolute;
              left: 0px;
              top: 100%;
            `}
          >
            <DayPickerRangeController
              numberOfMonths={2}
              focusedInput={this.state.focusedInput}
              onFocusChange={focusedInput => {
                this.$focusedInput.next(focusedInput);
              }}
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
        </div>
      </div>
    );
  }
}

export default DatesAgg;
