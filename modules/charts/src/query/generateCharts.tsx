import { QueryField } from '#components/Provider/hooks/useQueryFieldNames';
import { queryTemplateAggregations, queryTemplateNumericAggregations } from '#gql';

const queryTemplateCharts = ({ documentType, fieldQueries }) => {
	return `query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: true
          aggregations_filter_themselves: true
        ) {
         ${fieldQueries}
        }
      }
    }`;
};

// ugly but works, potentially use gql builder but overkill for small query templating
const generateQuery = ({ documentType, queryFields }: { documentType: string; queryFields: QueryField[] }) => {
	const fieldQueries = queryFields.reduce((query, { fieldName, gqlTypename }) => {
		switch (gqlTypename) {
			case 'Aggregations':
				return query + queryTemplateAggregations(fieldName);
			case 'NumericAggregations':
				return query + queryTemplateNumericAggregations(fieldName);
			default:
				console.log('Unsupported gql typename found');
				return '';
		}
	}, '');

	const query = queryTemplateCharts({ documentType, fieldQueries });

	return query;
};

export const generateChartsQuery = ({
	documentType,
	queryFields,
}: {
	documentType: string;
	queryFields: QueryField[];
}): string | null => {
	if (queryFields.length === 0) {
		console.log('No query fields available');
		return null;
	}
	console.log(`Generating query for fields: ${queryFields}`);
	return generateQuery({ documentType, queryFields });
};
