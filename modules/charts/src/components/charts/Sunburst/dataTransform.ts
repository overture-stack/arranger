type SunburstNode = {
	id: string;
	parent?: string;
	value?: number;
	children?: SunburstNode[];
};

type SunburstChartConfig = ChartConfig & {
	mapping: Record<string, string>;
};

// /**
//  * Resolves GraphQL aggregation buckets based on the aggregation type.
//  * Handles different GraphQL response structures for categorical vs numeric data.
//  */
// const resolveBuckets = ({ aggregations }: { aggregations: ArrangerAggregations }) => {
// 	switch (aggregations.__typename) {
// 		case aggregationsTypenames.Aggregations:
// 			return aggregations.buckets;
// 		case aggregationsTypenames.NumericAggregations:
// 			return aggregations.range?.buckets || [];
// 		default:
// 			return [];
// 	}
// };

export const createCategoryMap = (dynamicData, mapping) => {
	const categoryMap = new Map();
	// order to line up
	dynamicData.forEach((code) => {
		const parentId = mapping[code.key];

		// no cancer type mapping, skip
		if (!parentId) {
			return;
		}

		if (!categoryMap.has(parentId)) {
			categoryMap.set(parentId, { total: code.docCount, codes: [{ ...code, parentId }] });
		} else {
			const { total, codes: existingCodes } = categoryMap.get(parentId);
			const updatedCodes = existingCodes.concat([code]);
			categoryMap.set(parentId, { total: total + code.docCount, codes: updatedCodes });
		}
	});
	return categoryMap;
};

type Segment = {
	id: string;
	label: string;
	value: number | string;
	color: string;
	parentId?: string;
	children?: string[];
};

/**
 * Format for input into chart
 *
 * @param categoryMap
 * @returns
 */
export const createChartInput = (categoryMap) => {
	return Array.from(categoryMap).reduce<{
		inner: Segment[];
		outer: Segment[];
		legend: { label: string; color: string }[];
	}>(
		(acc, category, index) => {
			// @ts-ignore TS doesn't like tuple
			const [name, { codes, total }] = category;

			// don't show undefined values
			if (name === undefined) {
				return acc;
			}

			const inner = acc.inner.concat({
				id: name,
				label: name,
				value: total,
				children: codes.map((code) => code.key),
			});

			const outer = acc.outer.concat(
				codes.map((code) => ({
					id: code.key,
					label: code.key,
					value: code.docCount,
					parentId: code.parentId,
				})),
			);
			const legend = acc.legend.concat({ label: name });

			return { outer, inner, legend };
		},
		{
			legend: [],
			outer: [],
			inner: [],
		},
	);
};

/**
 * Creates a data transformation function for converting GraphQL responses to sunburst format.
 * Handles hierarchical data creation from multiple fields using user-provided mapping.
 *
 * @param config - Chart configuration including fieldNames and mapping
 * @returns Function that transforms GraphQL data to hierarchical sunburst format
 */
