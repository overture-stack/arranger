import React from 'react';
import DatePicker from 'react-datepicker';
import { css } from '@emotion/react';
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';

import { removeSQON, replaceSQON } from '@/SQONViewer/utils';
import { withTheme } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import AggsWrapper from './AggsWrapper';

const dateFromSqon = (dateString) => new Date(dateString);
const toSqonDate = (date) => date.valueOf();

const dateFormat = 'yyyy/MM/dd';
const fieldPlaceholder = dateFormat.toUpperCase();

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.initializeState(props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState(this.initializeState(nextProps));
  }

  initializeState = ({ stats = {}, getActiveValue = () => null }) => {
    const { fieldName } = this.props;
    const minDate = stats.min && subDays(stats.min, 1);
    const maxDate = stats.max && addDays(stats.max, 1);
    const startFromSqon = getActiveValue({ op: '>=', fieldName });
    const endFromSqon = getActiveValue({ op: '<=', fieldName });

    return {
      minDate,
      maxDate,
      startDate: startFromSqon ? dateFromSqon(startFromSqon) : null,
      endDate: endFromSqon ? dateFromSqon(endFromSqon) : null,
    };
  };

  updateSqon = () => {
    const { startDate, endDate } = this.state;
    const { fieldName, handleDateChange } = this.props;
    if (handleDateChange && fieldName) {
      const content = [
        ...(startDate
          ? [
              {
                op: '>=',
                content: {
                  fieldName,
                  value: toSqonDate(startOfDay(startDate)),
                },
              },
            ]
          : []),
        ...(endDate
          ? [
              {
                op: '<=',
                content: {
                  fieldName,
                  value: toSqonDate(endOfDay(endDate)),
                },
              },
            ]
          : []),
      ];
      handleDateChange({
        fieldName,
        value: content,
        generateNextSQON: (sqon) =>
          replaceSQON(content.length ? { op: 'and', content } : null, removeSQON(fieldName, sqon)),
      });
    }
  };

  handleDateChange = (limit) => (date) => {
    this.setState({ [`${limit}Date`]: date }, this.updateSqon);
  };

  render() {
    const {
      collapsible = true,
      displayName = 'Date Range',
      facetView = false,
      fieldName,
      theme: {
        colors,
        components: {
          Aggregations: {
            NoDataContainer: {
              fontColor: themeNoDataFontColor = colors?.grey?.[600],
              fontSize: themeNoDataFontSize = '0.8em',
            } = emptyObj,
          } = emptyObj,
        } = emptyObj,
      },
      type,
      WrapperComponent,
    } = this.props;
    const { minDate, maxDate, startDate, endDate } = this.state;
    const hasData = minDate && maxDate;

    const dataFields = {
      ...(fieldName && { 'data-fieldname': fieldName }),
      ...(type && { 'data-type': type }),
    };

    return (
      <AggsWrapper dataFields={dataFields} {...{ displayName, WrapperComponent, collapsible }}>
        {hasData ? (
          <div
            css={css`
              align-items: center;
              display: flex;
              justify-content: space-around;
              padding-left: 5px;

              .react-datepicker__current-month,
              .react-datepicker-time__header,
              .react-datepicker-year-header {
                color: ${colors?.grey?.[700]};
              }

              .react-datepicker__input-container {
                width: 100%;
              }

              .react-datepicker-wrapper input {
                border: 1px solid ${colors?.grey?.[400]};
                border-radius: 2px;
                box-sizing: border-box;
                font-size: 12px;
                padding: 6px 5px 5px 7px;
                width: 100%;
              }

              .react-datepicker__input-container .react-datepicker__close-icon::after {
                align-items: center;
                background-color: ${colors?.grey?.[500]};
                border-radius: 30%;
                display: flex;
                font-size: 14px;
                justify-content: center;
                height: 10px;
                line-height: 0;
                padding: 0.1rem;
                width: 10px;
              }

              .react-datepicker__day-name,
              .react-datepicker__day,
              .react-datepicker__time-name {
                line-height: 1.4rem;
                width: 1.5rem;
              }
            `}
          >
            <DatePicker
              {...{ minDate, maxDate }}
              aria-label={`Pick start date`}
              className="start-date"
              dateFormat={dateFormat}
              disabled={!hasData}
              isClearable
              onChange={this.handleDateChange('start')}
              openToDate={startDate || minDate}
              placeholderText={fieldPlaceholder}
              popperPlacement={facetView ? 'bottom-start' : 'top-start'}
              selected={startDate}
            />
            <span
              css={css`
                font-size: 13px;
                margin: 0 10px;
              `}
            >
              to
            </span>
            <DatePicker
              {...{ minDate, maxDate }}
              aria-label={`Pick end date`}
              className="end-date"
              dateFormat={dateFormat}
              disabled={!hasData}
              isClearable
              onChange={this.handleDateChange('end')}
              openToDate={endDate || maxDate}
              placeholderText={fieldPlaceholder}
              popperPlacement={facetView ? 'bottom-end' : 'top-start'}
              selected={endDate}
            />
          </div>
        ) : (
          <span
            className="no-data"
            css={css`
              color: ${themeNoDataFontColor};
              display: block;
              font-size: ${themeNoDataFontSize};
            `}
          >
            No data available
          </span>
        )}
      </AggsWrapper>
    );
  }
}

export default withTheme(DatesAgg);
