import React from 'react';
import Moment from 'moment';
import { DayPickerRangeController } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import { maxBy, minBy, sumBy } from 'lodash';
import { css } from 'emotion';
import {
  inCurrentSQON,
  replaceSQON,
  toggleSQON,
  removeSQON,
} from '../SQONView/utils';
import './AggregationCard.css';
import AggsWrapper from './AggsWrapper';
import './DatesAgg.css';

const START_DATE_INPUT = 'startDate';
const END_DATE_INPUT = 'endDate';
const BUCKET_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
const INPUT_DATE_FORMAT = 'YY/MM/DD';

const bucketDateToMoment = dateString => Moment(dateString, BUCKET_DATE_FORMAT);
const momentToBucketDate = moment => moment?.format(BUCKET_DATE_FORMAT);
const inputDateToMoment = dateString => Moment(dateString, INPUT_DATE_FORMAT);
const momentToInputDate = moment => moment?.format(INPUT_DATE_FORMAT);

const DATE_PICKER_POSITIONS = {
  BOTTOM_LEFT: css`
    position: absolute;
    left: 0%;
    top: 100%;
  `,
  BOTTOM_RIGHT: css`
    position: absolute;
    right: 0%;
    top: 100%;
  `,
  TOP_LEFT: css`
    position: absolute;
    left: 0%;
    bottom: 100%;
  `,
  TOP_RIGHT: css`
    position: absolute;
    right: 0%;
    bottom: 100%;
  `,
};

const Arrow = ({ style }) => (
  <svg
    style={style}
    className="DayPickerNavigation_svg__horizontal DayPickerNavigation_svg__horizontal_1"
    viewBox="0 0 1000 1000"
  >
    <path d="M694.4 242.4l249.1 249.1c11 11 11 21 0 32L694.4 772.7c-5 5-10 7-16 7s-11-2-16-7c-11-11-11-21 0-32l210.1-210.1H67.1c-13 0-23-10-23-23s10-23 23-23h805.4L662.4 274.5c-21-21.1 11-53.1 32-32.1z" />
  </svg>
);

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      localRange: this.getInitialRange(props), // the moment objects passed into DayPickerRangeController
      inputRangeValues: {
        // the strings to render in the inputs
        startDate: null,
        endDate: null,
      },
      focusedInput: null, // must be set with this.setInputFocus to bind with dom state
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      localRange: this.getInitialRange(nextProps),
    });
  }

  getInitialRange = ({ buckets = [], getActiveValue = () => ({}) }) => {
    const { field } = this.props;
    const bucketMoments = buckets.map(({ key_as_string, ...rest }) =>
      bucketDateToMoment(key_as_string),
    );
    const minDate = minBy(bucketMoments, moment => moment.valueOf());
    const maxDate = maxBy(bucketMoments, moment => moment.valueOf());

    const startFromSqon = getActiveValue({
      op: '>=',
      field,
    });
    const endFromSqon = getActiveValue({
      op: '<=',
      field,
    });
    return {
      startDate:
        (startFromSqon && bucketDateToMoment(startFromSqon)) || minDate,
      endDate: (startFromSqon && bucketDateToMoment(endFromSqon)) || maxDate,
    };
  };

  setInputFocus = focusedInput => {
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
  };

  handleInputValueChange = ({ value, input }) => {
    const { inputRangeValues, localRange } = this.state;
    const newMoment = inputDateToMoment(value);
    const isValidInputDateString =
      newMoment.isValid() && value.match(/^\d\d\/\d\d\/\d\d$/);
    if (!isValidInputDateString) {
      this.setState({
        inputRangeValues: { ...inputRangeValues, [input]: value },
      });
    } else {
      this.setState({
        inputRangeValues: {},
        localRange: {
          ...localRange,
          [input]: newMoment,
        },
      });
    }
  };

  onDatesSet = ({ startDate, endDate }) => {
    const {
      field = '',
      handleDateChange = ({ generateNextSQON }) => null,
    } = this.props;
    if (startDate && endDate) {
      handleDateChange({
        generateNextSQON: sqon =>
          replaceSQON(
            {
              op: 'and',
              content: [
                {
                  op: '>=',
                  content: {
                    field,
                    value: momentToBucketDate(startDate.startOf('day')),
                  },
                },
                {
                  op: '<=',
                  content: {
                    field,
                    value: momentToBucketDate(endDate.endOf('day')),
                  },
                },
              ],
            },
            sqon,
          ),
      });
    }
  };

  render() {
    const {
      displayName = 'Unnamed Field',
      collapsible = true,
      datePickerPosition = 'BOTTOM_LEFT',
      numberOfMonths = 2,
    } = this.props;

    const { localRange, inputRangeValues, focusedInput } = this.state;

    const getInitialVisibleMonth = () => {
      return (
        focusedInput &&
        (focusedInput === START_DATE_INPUT
          ? localRange.startDate || Moment()
          : localRange.endDate || Moment())
      );
    };

    return (
      <AggsWrapper {...{ displayName, collapsible }}>
        <div className={`datesAgg_inputRow`}>
          <input
            ref={el => (this.startDateInput = el)}
            onFocus={() => this.setInputFocus(START_DATE_INPUT)}
            className={`datesAgg_dateInput`}
            value={
              inputRangeValues.startDate
                ? inputRangeValues.startDate
                : momentToInputDate(localRange.startDate)
            }
            onChange={e =>
              this.handleInputValueChange({
                value: e.target.value,
                input: START_DATE_INPUT,
              })
            }
          />
          <div style={{ padding: 5 }}>
            <Arrow />
          </div>
          <input
            ref={el => (this.endDateInput = el)}
            onFocus={() => this.setInputFocus(END_DATE_INPUT)}
            className={`datesAgg_dateInput`}
            value={
              inputRangeValues.endDate
                ? inputRangeValues.endDate
                : momentToInputDate(localRange.endDate)
            }
            onChange={e =>
              this.handleInputValueChange({
                value: e.target.value,
                input: END_DATE_INPUT,
              })
            }
          />
          {focusedInput && (
            <div className={DATE_PICKER_POSITIONS[datePickerPosition]}>
              <DayPickerRangeController
                focusedInput={focusedInput}
                numberOfMonths={numberOfMonths}
                onFocusChange={focusedInput => this.setInputFocus(focusedInput)}
                initialVisibleMonth={getInitialVisibleMonth}
                startDate={localRange.startDate}
                endDate={localRange.endDate}
                isOutsideRange={() => false}
                onDatesChange={range => this.setState({ localRange: range })}
                hideKeyboardShortcutsPanel
                keepOpenOnDateSelect
              />
              <div className={`datesAgg_calendarNavbar`}>
                <div
                  className={`datesAgg_cancelButton`}
                  onClick={() => {
                    this.setState({
                      inputRangeValues: {},
                      localRange: this.getInitialRange(this.props),
                    });
                    this.setInputFocus(null);
                  }}
                >
                  cancel
                </div>
                <div
                  className={`datesAgg_submitButton`}
                  onClick={() => {
                    this.onDatesSet(localRange);
                    this.setInputFocus(null);
                    this.setState({
                      inputRangeValues: {},
                    });
                  }}
                >
                  Apply
                </div>
              </div>
            </div>
          )}
        </div>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
