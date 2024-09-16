export const createResponse = (resolvedResults) => {
	return resolvedResults.reduce((response, currentField) => {
		return { ...response, ...{ [currentField.fieldName]: { ...currentField.aggregation } } };
	}, {});
};
