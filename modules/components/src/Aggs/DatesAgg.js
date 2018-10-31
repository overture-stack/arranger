import React from 'react';
import Moment from 'moment';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { removeSQON, replaceSQON } from '../SQONView/utils';
import './AggregationCard.css';
import AggsWrapper from './AggsWrapper';
import './DatesAgg.css';

const SQON_DATE_FORMAT = 'YYYY-MM-DD';
const dateFromSqon = dateString => Moment(dateString, SQON_DATE_FORMAT);
const momentToSqonDate = moment => moment?.format(SQON_DATE_FORMAT);

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.initializeState(props);
  }

  componentWillReceiveProps(nextProps) {
    this.setState(this.initializeState(nextProps));
  }

  initializeState = ({ stats = {}, getActiveValue = () => null }) => {
    const { field } = this.props;
    const minDate = stats.min && Moment(stats.min).subtract(1, 'days');
    const maxDate = stats.max && Moment(stats.max).add(1, 'days');
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
                  value: momentToSqonDate(startDate.startOf('day')),
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
                  value: momentToSqonDate(endDate.endOf('day')),
                },
              },
            ]
          : []),
      ];
      handleDateChange({
        field,
        value: content,
        generateNextSQON: sqon =>
          replaceSQON(
            content.length ? { op: 'and', content } : null,
            removeSQON(field, sqon),
          ),
      });
    }
  };

  render() {
    const {
      displayName = 'Date Range',
      collapsible = true,
      WrapperComponent,
      facetView = false,
    } = this.props;
    const { minDate, maxDate, startDate, endDate } = this.state;
    return (
      <AggsWrapper {...{ displayName, WrapperComponent, collapsible }}>
        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: space-around;
          `}
        >
          <DatePicker
            {...{ minDate, maxDate }}
            isClearable
            openToDate={minDate}
            popperPlacement={facetView ? 'bottom-start' : 'top-start'}
            disabledKeyboardNavigation
            placeholderText="Start Date"
            selected={startDate}
            onChange={x => this.setState({ startDate: x }, this.updateSqon)}
            aria-label={`Pick start date`}
          />
          <DatePicker
            {...{ minDate, maxDate }}
            isClearable
            openToDate={maxDate}
            popperPlacement={facetView ? 'bottom-end' : 'top-start'}
            disabledKeyboardNavigation
            placeholderText="End Date"
            selected={endDate}
            onChange={x => this.setState({ endDate: x }, this.updateSqon)}
            aria-label={`Pick end date`}
          />
        </div>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
