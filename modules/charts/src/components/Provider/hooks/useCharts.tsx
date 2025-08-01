import { useState } from 'react';

export const useChartFields = ({ documentType }) => {
	// Although we can have multiple charts with same fieldName, they are referencing the same data
	const [registeredFieldNames, setRegisteredFieldNames] = useState(new Set());

	const registerFieldName = (fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (prev.has(fieldName)) {
				console.log('Field already registered:', fieldName);
				return prev;
			}

			const newFields = new Set(prev);
			newFields.add(fieldName);
			console.log('Field registered successfully:', fieldName);
			console.log('Current registered fields:', Array.from(newFields));
			return newFields;
		});
	};

	const deregisterFieldName = (fieldName: string) => {
		setRegisteredFieldNames((prev) => {
			if (!prev.has(fieldName)) return prev;

			const newFields = new Set(prev);
			newFields.delete(fieldName);
			return newFields;
		});
	};

	return {
		registeredFieldNames,
		registerFieldName,
		deregisterFieldName,
	};
};
