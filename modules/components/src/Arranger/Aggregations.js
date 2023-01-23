import { sortBy } from 'lodash';
import cx from 'classnames';

import { AggsState, AggsQuery } from '@/Aggs';
import aggComponents from '@/Aggs/aggComponentsMap';
import { withData } from '@/DataContext';
import noopFn, { emptyArrFn, emptyObj, emptyObjFn } from '@/utils/noops';

const BaseWrapper = ({ className, ...props }) => (
	<section {...props} className={cx('aggregations', className)} />
);

export const AggregationsListDisplay = ({
	aggs,
	componentProps = {
		getBooleanAggProps: emptyObjFn,
		getDatesAggProps: emptyObjFn,
		getRangeAggProps: emptyObjFn,
		getTermAggProps: emptyObjFn,
	},
	containerRef,
	customFacets = [],
	data,
	getCustomItems = emptyArrFn, // ({ aggs }) => Array<{index: number, component: Component | Function}>
	documentType,
	onValueChange = noopFn,
	setSQON,
	sqon,
}) => {
	const aggComponentInstances =
		data &&
		aggs
			.map((agg) => ({
				...agg,
				...data?.[documentType]?.aggregations?.[agg?.fieldName],
				...data?.[documentType]?.configs?.extended?.find(
					(extendedField) => extendedField.fieldName.replace(/\./g, '__') === agg.fieldName,
				),
				onValueChange: ({ sqon, value }) => {
					onValueChange(value);
					setSQON(sqon);
				},
				key: agg.fieldName,
				sqon,
				containerRef,
			}))
			.map((agg) => {
				const customContent =
					customFacets.find((x) => x.content.fieldName === agg.fieldName)?.content || {};

				return {
					...agg,
					...customContent,
				};
			})
			.map((agg) => aggComponents[agg.type]?.({ ...agg, ...componentProps }));

	if (data && aggComponentInstances) {
		// sort the list by the index specified for each component to prevent order bumping
		const componentListToInsert = sortBy(getCustomItems({ aggs }), 'index');
		// go through the list of inserts and inject them by splitting and joining
		const inserted = componentListToInsert.reduce((acc, { index, component }) => {
			const firstChunk = acc.slice(0, index);
			const secondChunk = acc.slice(index, acc.length);
			return [...firstChunk, component(), ...secondChunk];
		}, aggComponentInstances);

		return inserted;
	} else {
		// TODO: study what is returned here if !aggComponentInstances, are we handling it?
		return aggComponentInstances;
	}
};

export const AggregationsList = ({
	aggs = [],
	apiFetcher,
	componentProps = {
		getBooleanAggProps: emptyObjFn,
		getDatesAggProps: emptyObjFn,
		getRangeAggProps: emptyObjFn,
		getTermAggProps: emptyObjFn,
	},
	containerRef,
	customFacets = [],
	debounceTime = 300,
	getCustomItems,
	documentType,
	onValueChange = noopFn,
	setSQON,
	sqon,
}) => (
	<AggsQuery
		aggs={aggs}
		apiFetcher={apiFetcher}
		debounceTime={debounceTime}
		index={documentType}
		render={({ data }) =>
			AggregationsListDisplay({
				aggs,
				componentProps,
				containerRef,
				customFacets,
				data,
				getCustomItems,
				documentType,
				onValueChange,
				setSQON,
				sqon,
			})
		}
		sqon={sqon}
	/>
);

/**
 * @param {array} customFacets Allows custom content to be passed to each facet in the aggregation list.
 *   This can overwrite any property in the agg object in the aggregation list
 *   The structure of this property is:
 *   [
 *     {
 *       content: {
 *         field: 'field_name', // identify which facet this object customizes
 *         displayName: 'New Display Name for This Field', // modify displayName of the facet
 *       },
 *     },
 *   ]
 * @param {SQONType} sqon
 */
const Aggregations = ({
	apiFetcher,
	className = '',
	componentProps = {
		getTermAggProps: emptyObjFn,
		getRangeAggProps: emptyObjFn,
		getBooleanAggProps: emptyObjFn,
		getDatesAggProps: emptyObjFn,
	},
	containerRef = null,
	customFacets = [],
	documentType = '',
	onValueChange = noopFn,
	setSQON = noopFn,
	sqon = null,
	style = emptyObj,
	Wrapper = BaseWrapper,
}) => {
	return (
		<Wrapper className={className} style={style}>
			<AggsState
				apiFetcher={apiFetcher}
				documentType={documentType}
				render={(aggsState) => {
					const aggs = aggsState.aggs.filter((agg) => agg.show);

					return (
						<AggregationsList
							aggs={aggs}
							apiFetcher={apiFetcher}
							componentProps={componentProps}
							containerRef={containerRef}
							customFacets={customFacets}
							documentType={documentType}
							onValueChange={onValueChange}
							setSQON={setSQON}
							sqon={sqon}
							Wrapper={Wrapper}
						/>
					);
				}}
			/>
		</Wrapper>
	);
};

export default withData(Aggregations);
