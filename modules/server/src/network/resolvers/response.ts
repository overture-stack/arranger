export const createResponse = (resolvedResults) => {
	resolvedResults.reduce((response, currentField) => {
		return { ...response, ...{ [currentField.fieldName]: { ...currentField.aggregation } } };
	}, {});
};
