import { currentFieldValue, fieldInCurrentSQON, inCurrentSQON } from '#SQONViewer/utils.js';
import noopFn from '#utils/noops.js';

import BooleanAggs from './BooleanAggs/index.js';
import DatesAggs from './DatesAgg.js';
import RangeAggs from './RangeAgg.js';
import TermAggs from './TermAggs/index.js';

// TODO: should these "isActive" functions be renamed to "getWhatever"?
// what does "active" mean, practically, in this context?
// TODO: also, what's with all the missmatching methods!? Fix it, Justin!
// e.g. onValueChange vs HandleDateChange vs handleChange vs handleValueClick

const composedBooleanAggs = ({ sqon, onValueChange, getBooleanAggsProps = () => ({}), ...rest }) => (
	<BooleanAggs
		{...{ ...rest, ...getBooleanAggsProps() }}
		handleValueClick={({ fieldName, generateNextSQON, value }) => {
			const nextSQON = generateNextSQON(sqon);

			onValueChange({
				sqon: nextSQON,
				value: {
					fieldName,
					isActive: fieldInCurrentSQON({
						currentSQON: nextSQON ? nextSQON.content : [],
						fieldName,
					}),
					value,
				},
			});
		}}
		isActive={(field) =>
			inCurrentSQON({
				value: field.value,
				dotFieldName: field.fieldName,
				currentSQON: sqon,
			})
		}
	/>
);

const composedDatesAgg = ({ sqon, onValueChange, getDatesAggProps = () => ({}), ...rest }) => (
	<DatesAggs
		{...{ ...rest, ...getDatesAggProps() }}
		getActiveValue={({ op, fieldName }) =>
			currentFieldValue({
				op,
				dotFieldName: fieldName,
				sqon,
			})
		}
		handleDateChange={({ fieldName, generateNextSQON = noopFn, value } = {}) => {
			const nextSQON = generateNextSQON(sqon);
			onValueChange({
				sqon: nextSQON,
				value: {
					fieldName,
					isActive: fieldInCurrentSQON({
						currentSQON: nextSQON ? nextSQON.content : [],
						fieldName,
					}),
					value,
				},
			});
		}}
	/>
);

const composedRangeAgg = ({ sqon, onValueChange, fieldName, stats, getRangeAggProps = () => ({}), ...rest }) => (
	<RangeAggs
		{...{ ...rest, stats, fieldName, ...getRangeAggProps() }}
		handleChange={({ generateNextSQON, field: { displayName, displayUnit, fieldName }, value }) => {
			const nextSQON = generateNextSQON(sqon);

			onValueChange({
				sqon: nextSQON,
				value: {
					fieldName: `${displayName} (${displayUnit})`,
					isActive: fieldInCurrentSQON({
						currentSQON: nextSQON?.content,
						fieldName,
					}),
					value,
				},
			});
		}}
		sqonValues={
			!!sqon && {
				min: currentFieldValue({ sqon, dotFieldName: fieldName, op: '>=' }),
				max: currentFieldValue({ sqon, dotFieldName: fieldName, op: '<=' }),
			}
		}
	/>
);

const composedTermAgg = ({ sqon, onValueChange, getTermAggProps = () => ({}), ...rest }) => (
	<TermAggs
		{...{ ...rest, ...getTermAggProps() }}
		handleValueClick={({ fieldName, generateNextSQON, value }) => {
			const nextSQON = generateNextSQON(sqon);
			const isActive = fieldInCurrentSQON({
				currentSQON: nextSQON?.content || [],
				fieldName,
			});

			onValueChange({
				sqon: nextSQON,
				value: {
					fieldName,
					isActive,
					value,
				},
			});
		}}
		isActive={(field) => {
			return inCurrentSQON({
				value: field.value,
				dotFieldName: field.fieldName,
				currentSQON: sqon,
			});
		}}
	/>
);

export default {
	boolean: composedBooleanAggs,
	byte: composedRangeAgg,
	date: composedDatesAgg,
	float: composedRangeAgg,
	half_float: composedRangeAgg,
	integer: composedRangeAgg,
	keyword: composedTermAgg,
	long: composedRangeAgg,
	scaled_float: composedRangeAgg,
	text: composedTermAgg,
	unsigned_long: composedRangeAgg,
};
