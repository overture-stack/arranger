import { isEmpty } from 'lodash';

interface SunburstData {
	legend: { label: string; color: string }[];
	outer: any[];
	inner: any[];
}

export interface SunburstMappingFn {
	(key: string): string;
}

export interface ChartInput {
	data: any;
	mapper: SunburstMappingFn;
	maxSegments: number;
}

/**
 * Creates a data transformation function for converting GraphQL responses to sunburst format.
 * Handles hierarchical data creation from multiple fields using user-provided mapping.
 *
 **/
export const createSunburstSegments = ({ data, mapper, maxSegments }: ChartInput): SunburstData | {} => {
	if (isEmpty(data)) {
		return {};
	}

	// create category Map to simplify later reduce
	const categoryMap = new Map();
	data.forEach((code) => {
		const parentId = mapper(code.key);

		// no cancer type mapping, skip
		if (!parentId) {
			return;
		}

		if (!categoryMap.has(parentId)) {
			categoryMap.set(parentId, { total: code.value, codes: [{ ...code, parentId }] });
		} else {
			const { total, codes: existingCodes } = categoryMap.get(parentId);
			const updatedCodes = existingCodes.concat([code]);
			categoryMap.set(parentId, { total: total + code.value, codes: updatedCodes });
		}
	});

	const mappedData = Array.from(categoryMap).reduce<SunburstData>(
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
					value: code.value,
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

	// account for user supplied mapping incomplete
	if (mappedData.inner.length === 0 || mappedData.outer.length === 0) {
		return {};
	}
	// slice by maxSegments after data is resolved because the outer rings are the dynamic data
	const slicedInner = mappedData.inner.slice(0, maxSegments);
	const outer = slicedInner
		.flatMap((parent) => parent.children)
		.map((outerId) => mappedData.outer.find(({ id }) => id === outerId));
	const sunburstData: SunburstData = {
		inner: slicedInner,
		outer,
		legend: mappedData.legend.slice(0, maxSegments),
	};

	return sunburstData;
};
