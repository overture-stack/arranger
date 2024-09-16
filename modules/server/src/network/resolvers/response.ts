export const createResponse = (resolvedResults) => {
	const data = resolvedResults.reduce((response, currentField) => {
		return { ...response, ...{ [currentField.fieldName]: { ...currentField.aggregation } } };
	}, {});
	/*
	 * Querying {network: {aggregations...}} so omit "network" in the returned object
	 * GQL type and resolvers need to match
	 */
	return { aggregations: data };
};
