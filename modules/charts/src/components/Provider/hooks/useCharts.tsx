import { generateChartsQuery } from '#query/generateCharts';
import { useMemo, useState } from 'react';

export const useChartFields = ({ documentType }) => {
	// TODO: surely can have multiple charts supported with same fieldname?
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

	// Generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, fieldNames: registeredFieldNames });
	}, [documentType, registeredFieldNames]);

	return {
		gqlQuery,
		registerFieldName,
		deregisterFieldName,
	};
};
