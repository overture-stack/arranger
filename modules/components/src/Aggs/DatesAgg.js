import React from 'react';
import DatePicker from 'react-datepicker';
import { css } from '@emotion/react';
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';

import { removeSQON, replaceSQON } from '../SQONView/utils';
import AggsWrapper from './AggsWrapper';

import 'react-datepicker/dist/react-datepicker.css';
import './DatesAgg.css';

const dateFromSqon = (dateString) => new Date(dateString);
const toSqonDate = (date) => date.valueOf();

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.initializeState(props);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState(this.initializeState(nextProps));
  }

  initializeState = ({ stats = {}, getActiveValue = () => null }) => {
    const { field } = this.props;
    const minDate = stats.min && subDays(stats.min, 1);
    const maxDate = stats.max && addDays(stats.max, 1);
    const startFromSqon = getActiveValue({ op: '>=', field });
    const endFromSqon = getActiveValue({ op: '<=', field });

    return {
      minDate,
      maxDate,
      startDate: startFromSqon ? dateFromSqon(startFromSqon) : null,
      endDate: endFromSqon ? dateFromSqon(endFromSqon) : null,
    };
  };

  updateSqon = () => {
    const { startDate, endDate } = this.state;
    const { field, handleDateChange } = this.props;
    if (handleDateChange && field) {
      const content = [
        ...(startDate
          ? [
              {
                op: '>=',
                content: {
                  field,
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
                  field,
                  value: toSqonDate(endOfDay(endDate)),
                },
              },
            ]
          : []),
      ];
      handleDateChange({
        field,
        value: content,
        generateNextSQON: (sqon) =>
          replaceSQON(content.length ? { op: 'and', content } : null, removeSQON(field, sqon)),
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
      field,
      type,
      WrapperComponent,
    } = this.props;
    const { minDate, maxDate, startDate, endDate } = this.state;

    const dataFields = {
      ...(field && { 'data-field': field }),
      ...(type && { 'data-type': type }),
    };

    return (
      <AggsWrapper dataFields={dataFields} {...{ displayName, WrapperComponent, collapsible }}>
        <div
          css={css`
            align-items: center;
            display: flex;
            justify-content: space-around;
            padding-left: 5px;
          `}
        >
          <DatePicker
            {...{ minDate, maxDate }}
            aria-label={`Pick start date`}
            className="start-date"
            isClearable
            onChange={this.handleDateChange('start')}
            openToDate={startDate || minDate}
            placeholderText="YYYY/MM/DD"
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
            isClearable
            onChange={this.handleDateChange('end')}
            openToDate={endDate || maxDate}
            placeholderText="YYYY/MM/DD"
            popperPlacement={facetView ? 'bottom-end' : 'top-start'}
            selected={endDate}
          />
        </div>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
