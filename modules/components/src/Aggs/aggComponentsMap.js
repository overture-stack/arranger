import { BooleanAgg, DatesAgg, RangeAgg, TermAgg } from '@/Aggs';
import { currentFieldValue, fieldInCurrentSQON, inCurrentSQON } from '@/SQONViewer/utils';
import noopFn from '@/utils/noops';

// TODO: should these "isActive" functions be renamed to "getWhatever"?

const composedTermAgg = ({ sqon, onValueChange, getTermAggProps = () => ({}), ...rest }) => (
	<TermAgg
		{...{ ...rest, ...getTermAggProps() }}
		handleValueClick={({ fieldName, generateNextSQON, value }) => {
			let nextSQON = generateNextSQON(sqon);
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

const composedRangeAgg = ({
	sqon,
	onValueChange,
	fieldName,
	stats,
	getRangeAggProps = () => ({}),
	...rest
}) => (
	<RangeAgg
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

const composedBooleanAgg = ({ sqon, onValueChange, getBooleanAggProps = () => ({}), ...rest }) => (
	<BooleanAgg
		{...{ ...rest, ...getBooleanAggProps() }}
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
				dotFieldname: field.fieldName,
				currentSQON: sqon,
			})
		}
	/>
);

const composedDatesAgg = ({ sqon, onValueChange, getDatesAggProps = () => ({}), ...rest }) => (
	<DatesAgg
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

export default {
	boolean: composedBooleanAgg,
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
