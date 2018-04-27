import React from 'react';
import Moment from 'moment';
import { DateRangePicker } from 'react-dates';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import { maxBy, minBy } from 'lodash';
import { replaceSQON } from '../SQONView/utils';
import './AggregationCard.css';
import AggsWrapper from './AggsWrapper';
import './DatesAgg.css';

const BUCKET_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSSSSS';
const bucketDateToMoment = dateString => Moment(dateString, BUCKET_DATE_FORMAT);
const momentToBucketDate = moment => moment?.format(BUCKET_DATE_FORMAT);

class DatesAgg extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      ...this.getInitialRange(props),
      focusedInput: null, // must be set with this.setInputFocus to bind with dom state
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState(this.getInitialRange(nextProps));
  }

  getInitialRange = ({ buckets = [], getActiveValue = () => ({}) }) => {
    const { field } = this.props;
    const bucketMoments = buckets.map(x => bucketDateToMoment(x.key_as_string));
    const minDate = minBy(bucketMoments, moment => moment.valueOf());
    const maxDate = maxBy(bucketMoments, moment => moment.valueOf());
    const startFromSqon = getActiveValue({ op: '>=', field });
    const endFromSqon = getActiveValue({ op: '<=', field });
    return {
      startDate: startFromSqon ? bucketDateToMoment(startFromSqon) : minDate,
      endDate: endFromSqon ? bucketDateToMoment(endFromSqon) : maxDate,
    };
  };

  updateSqon = ({ startDate, endDate } = {}) => {
    const { field, handleDateChange } = this.props;
    if (handleDateChange && field && startDate && endDate) {
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
      displayName = 'Date Range',
      collapsible = true,
      numberOfMonths = 2,
      WrapperComponent,
    } = this.props;
    const { startDate, endDate, focusedInput } = this.state;
    return (
      <AggsWrapper {...{ displayName, WrapperComponent, collapsible }}>
        <div className={`datesAgg_inputRow`}>
          <DateRangePicker
            small
            noBorder
            startDate={startDate}
            startDateId="start_date_id"
            endDate={endDate}
            endDateId="end_date_id"
            onDatesChange={range => {
              this.setState(range);
              this.updateSqon(range);
            }}
            focusedInput={focusedInput}
            onFocusChange={focusedInput => this.setState({ focusedInput })}
            numberOfMonths={numberOfMonths}
            isOutsideRange={() => false}
            hideKeyboardShortcutsPanel
            withPortal
          />
        </div>
      </AggsWrapper>
    );
  }
}

export default DatesAgg;
