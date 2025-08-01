import { AggregationsQuery } from '#gql';

const generateQuery = ({ documentType, fieldNames }) => {
	const fullQuery = `
    query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: true
          aggregations_filter_themselves: true
        ) {
          ${Array.from(fieldNames).map((fieldName) => AggregationsQuery(fieldName))}
        }
      }
    }`;

	return fullQuery;
};

export const generateChartsQuery = ({ documentType, fieldNames }) => {
	if (fieldNames.size === 0) {
		console.log('No fields, query is null');
		return null;
	}
	console.log('Generating query for fields:', Array.from(fieldNames));
	return generateQuery({ documentType, fieldNames });
};
