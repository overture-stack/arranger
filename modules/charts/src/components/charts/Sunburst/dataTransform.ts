import { isEmpty } from 'lodash';

type SunburstNode = {
	id: string;
	parent?: string;
	value?: number;
	children?: SunburstNode[];
};

type SunburstChartConfig = ChartConfig & {
	mapping: Record<string, string>;
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
 * Creates a data transformation function for converting GraphQL responses to sunburst format.
 * Handles hierarchical data creation from multiple fields using user-provided mapping.
 *
 **/
export const createChartInput = (gqlData, mapping) => {
	if (isEmpty(gqlData)) {
		return {};
	}

	// create category Map, simplify later reduce
	const categoryMap = new Map();
	gqlData.forEach((code) => {
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
	const sunburstData = Array.from(categoryMap).reduce<{
		inner: Segment[];
		outer: Segment[];
		legend: { label: string; color: string }[];
	}>(
		(acc, category) => {
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

	// user supplied mapping may not be complete
	if (sunburstData.inner.length === 0 || sunburstData.outer.length === 0) {
		return {};
	}

	return sunburstData;
};
