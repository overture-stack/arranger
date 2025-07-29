import { css } from '@emotion/react';
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns';
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { removeSQON, replaceSQON } from '#SQONViewer/utils.js';
import { withTheme } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import AggsGroup from './AggsGroup/index.js';

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

	initializeState = ({ getActiveValue = () => null, stats = {}, enforceStatsMax = false }) => {
		const { fieldName } = this.props;
		const minDate = stats.min && subDays(stats.min, 1);
		const statsMax = stats.max && addDays(stats.max, 1);
		const maxDate = enforceStatsMax ? statsMax : Math.max(Date.now(), statsMax);
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
					Input: {
						borderColor: themeInputBorderColor = colors?.grey?.[400],
						boxShadow: themeInputBoxShadow,
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
			<AggsGroup
				dataFields={dataFields}
				theme={{
					displayName,
					filtering: false,
					sorting: false,
					WrapperComponent
				}}
			>
				{hasData ? (
					<div
						css={css`
							align-items: center;
							display: flex;
							justify-content: space-around;
							padding-left: 5px;

							.react-datepicker__current-month {
								display: none;
							}

							.react-datepicker-time__header,
							.react-datepicker-year-header {
								color: ${colors?.grey?.[700]};
							}

							.react-datepicker__day-name,
							.react-datepicker__day,
							.react-datepicker__time-name {
								line-height: 1.4rem;
								width: 1.5rem;
							}

							.react-datepicker__header__dropdown {
								display: flex;
								justify-content: center;
							}

							.react-datepicker__input-container {
								width: 100%;

								.react-datepicker__close-icon::after {
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
							}

							.react-datepicker__month-option--selected {
								left: 10px;
							}

							.react-datepicker__month-read-view,
							.react-datepicker__year-read-view {
								border: none;
								visibility: visible !important;
								/* ^^ otherwise the current becomes invisible when dropdown is displayed */
								width: fit-content;
							}

							.react-datepicker__month-read-view--down-arrow,
							.react-datepicker__year-read-view--down-arrow {
								display: none;
							}

							.react-datepicker__month-read-view--selected-month,
							.react-datepicker__year-read-view--selected-year {
								font-size: 0.9rem;
								font-weight: bold;
							}

							.react-datepicker-wrapper input {
								border: 1px solid ${themeInputBorderColor};
								border-radius: 2px;
								box-sizing: border-box;
								font-size: 12px;
								padding: 6px 5px 5px 7px;
								width: 100%;

								&:focus {
									box-shadow: ${themeInputBoxShadow};
								}
							}
						`}
					>
						<DatePicker
							{...{ minDate, maxDate }}
							aria-label={`Pick start date`}
							className="start-date"
							closeOnScroll
							dateFormat={dateFormat}
							disabled={!hasData}
							isClearable
							onChange={this.handleDateChange('start')}
							openToDate={startDate || minDate}
							placeholderText={fieldPlaceholder}
							popperPlacement={facetView ? 'bottom-start' : 'top-start'}
							selected={startDate}
							showMonthDropdown
							showYearDropdown
							todayButton="Select Today"
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
							closeOnScroll
							dateFormat={dateFormat}
							disabled={!hasData}
							isClearable
							onChange={this.handleDateChange('end')}
							openToDate={endDate || maxDate}
							placeholderText={fieldPlaceholder}
							popperPlacement={facetView ? 'bottom-end' : 'top-start'}
							selected={endDate}
							showMonthDropdown
							showYearDropdown
							todayButton="Select Today"
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
			</AggsGroup>
		);
	}
}

export default withTheme(DatesAgg);
