import React from 'react';
import Moment from 'moment';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { maxBy, minBy } from 'lodash';

import { removeSQON, replaceSQON } from '../SQONView/utils';
import './AggregationCard.css';
import AggsWrapper from './AggsWrapper';
import './DatesAgg.css';

const BUCKET_DATE_FORMAT = 'YYYY-MM-DD';
const bucketDateToMoment = dateString => Moment(dateString, BUCKET_DATE_FORMAT);
const momentToBucketDate = moment => moment?.format(BUCKET_DATE_FORMAT);

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.initializeState(props);
  }

  componentWillReceiveProps(nextProps) {
    this.setState(this.initializeState(nextProps));
  }

  initializeState = ({ buckets = [], getActiveValue = () => ({}) }) => {
    const { field } = this.props;
    const bucketMoments = buckets.map(x => bucketDateToMoment(x.key_as_string));
    const minDate = minBy(bucketMoments, x => x.valueOf()).subtract(1, 'days');
    const maxDate = maxBy(bucketMoments, x => x.valueOf()).add(1, 'days');
    const startFromSqon = getActiveValue({ op: '>=', field });
    const endFromSqon = getActiveValue({ op: '<=', field });
    return {
      minDate,
      maxDate,
      startDate: startFromSqon ? bucketDateToMoment(startFromSqon) : null,
      endDate: endFromSqon ? bucketDateToMoment(endFromSqon) : null,
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
                  value: momentToBucketDate(startDate.startOf('day')),
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
                  value: momentToBucketDate(endDate.endOf('day')),
                },
              },
            ]
          : []),
      ];
      handleDateChange({
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
            popperPlacement="top-start"
            disabledKeyboardNavigation
            placeholderText="Start Date"
            selected={startDate}
            onChange={x => this.setState({ startDate: x }, this.updateSqon)}
          />
          <DatePicker
            {...{ minDate, maxDate }}
            isClearable
            openToDate={maxDate}
            popperPlacement="top-start"
            disabledKeyboardNavigation
            placeholderText="End Date"
            selected={endDate}
            onChange={x => this.setState({ endDate: x }, this.updateSqon)}
          />
        </div>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
