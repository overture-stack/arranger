/**
 *
 * @param param0
 */
export const applyAggregationMasking = ({
	aggregations,
	thresholdMin,
}: {
	aggregations: Record<
		string,
		{
			bucket_count: number;
			buckets: Array<{
				doc_count: number;
				key: string;
			}>;
		}
	>;
	thresholdMin: number;
}) => {
	const x = Object.entries(aggregations).reduce((acc, [aggName, aggValue]) => {
		const buckets = aggValue.buckets;
		const isApplyingThreshold = buckets.some((bucket) => bucket.doc_count < thresholdMin);
		if (isApplyingThreshold) {
			const modifiedAggValue = {
				...aggValue,
				buckets: buckets.map((bucket) => ({
					...bucket,
					doc_count: thresholdMin - 1,
					belowThreshold: true,
				})),
			};
			return { ...acc, [aggName]: modifiedAggValue };
		}
		return { ...acc, [aggName]: aggValue };
	}, {});

	console.log(JSON.stringify(x));
	return x;
};
