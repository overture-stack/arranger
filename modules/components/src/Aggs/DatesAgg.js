import React from 'react';
import Moment from 'moment';
import { DayPickerRangeController } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import { maxBy, minBy, sumBy } from 'lodash';
import { css } from 'emotion';
import Component from 'react-component-component';
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
  // needs ref...

  render() {
    const {
      field = '',
      displayName = 'Unnamed Field',
      buckets = [],
      collapsible = true,
      handleDateChange = ({ generateNextSQON }) => null,
      startDateFromSqon = () => null,
      endDateFromSqon = () => null,
      datePickerPosition = 'BOTTOM_LEFT',
    } = this.props;

    const onDatesSet = ({ startDate, endDate }) => {
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

    const getDateFromSqon = dateToGet => sqon =>
      sqon?.content
        ?.filter(({ content: { field: sqonField } }) => {
          return sqonField === field;
        })
        ?.find(
          ({ op }) => op === (dateToGet === START_DATE_INPUT ? '>=' : '<='),
        )?.content.value;

    const getInitialRange = () => {
      const bucketWithMoment = buckets.map(({ key_as_string, ...rest }) => ({
        ...rest,
        key_as_string,
        moment: bucketDateToMoment(key_as_string),
      }));
      const minBucket = minBy(bucketWithMoment, ({ moment }) =>
        moment.valueOf(),
      );
      const maxBucket = maxBy(bucketWithMoment, ({ moment }) =>
        moment.valueOf(),
      );

      const startFromSqon = startDateFromSqon({
        getDateFromSqon: getDateFromSqon(START_DATE_INPUT),
      });
      const endFromSqon = endDateFromSqon({
        getDateFromSqon: getDateFromSqon(END_DATE_INPUT),
      });
      return {
        startDate:
          (startFromSqon && bucketDateToMoment(startFromSqon)) ||
          minBucket?.moment,
        endDate:
          (startFromSqon && bucketDateToMoment(endFromSqon)) ||
          maxBucket?.moment,
      };
    };

    const initialRange = getInitialRange();

    return (
      <AggsWrapper {...{ displayName, collapsible }}>
        <Component
          initialState={{
            localRange: { ...initialRange }, // the moment objects passed into DayPickerRangeController
            inputRangeValues: {
              // the strings to render in the inputs
              startDate: null,
              endDate: null,
            },
            focusedInput: null,
          }}
        >
          {({
            state: { localRange, inputRangeValues, focusedInput },
            setState,
          }) => {
            const handleInputValueChange = ({ value, input }) => {
              const newMoment = inputDateToMoment(value);
              const isValidInputDateString =
                newMoment.isValid() &&
                sumBy(value.split('/'), str => str.length === 2) === 3;
              if (!isValidInputDateString) {
                setState({
                  inputRangeValues: { ...inputRangeValues, [input]: value },
                });
              } else {
                setState({
                  inputRangeValues: {},
                  localRange: {
                    ...localRange,
                    [input]: newMoment,
                  },
                });
              }
            };
            const setInputFocus = focusedInput => {
              setState({ focusedInput }, () => {
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
            const getInitialVisibleMonth = () =>
              focusedInput &&
              (focusedInput === START_DATE_INPUT
                ? initialRange.startDate || Moment()
                : initialRange.endDate || Moment());
            return (
              <div className={`inputRow`}>
                <input
                  ref={el => (this.startDateInput = el)}
                  onFocus={() => setInputFocus(START_DATE_INPUT)}
                  className={`dateInput`}
                  value={
                    inputRangeValues.startDate
                      ? inputRangeValues.startDate
                      : momentToInputDate(localRange.startDate)
                  }
                  onChange={e =>
                    handleInputValueChange({
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
                  onFocus={() => setInputFocus(END_DATE_INPUT)}
                  className={`dateInput`}
                  value={
                    inputRangeValues.endDate
                      ? inputRangeValues.endDate
                      : momentToInputDate(localRange.endDate)
                  }
                  onChange={e =>
                    handleInputValueChange({
                      value: e.target.value,
                      input: END_DATE_INPUT,
                    })
                  }
                />
                {focusedInput && (
                  <div className={DATE_PICKER_POSITIONS[datePickerPosition]}>
                    <DayPickerRangeController
                      {...{
                        focusedInput,
                        numberOfMonths: 2,
                        onFocusChange: focusedInput =>
                          setInputFocus(focusedInput),
                        initialVisibleMonth: getInitialVisibleMonth,
                        startDate: localRange.startDate,
                        endDate: localRange.endDate,
                        isOutsideRange: () => false,
                        onDatesChange: range => {
                          setState({
                            localRange: range,
                          });
                        },
                      }}
                      hideKeyboardShortcutsPanel
                      keepOpenOnDateSelect
                    />
                    <div className={`calendarNavbar`}>
                      <div
                        className={`cancelButton`}
                        onClick={() => {
                          setState({
                            inputRangeValues: {},
                            localRange: { ...initialRange },
                          });
                          setInputFocus(null);
                        }}
                      >
                        cancel
                      </div>
                      <div
                        className={`submitButton`}
                        onClick={() => {
                          onDatesSet(localRange);
                          setInputFocus(null);
                          setState({
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
            );
          }}
        </Component>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
