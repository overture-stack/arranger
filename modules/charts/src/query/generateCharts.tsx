import { ChartAggregation } from '#components/charts/Barchart/hooks/useValidateInput';
import { queryTemplateAggregations, queryTemplateNumericAggregations } from '#gql';
import { aggregationsTypenames } from '#shared';

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
const generateQuery = ({
	documentType,
	queryFields,
}: {
	documentType: string;
	queryFields: Map<string, ChartAggregation>;
}) => {
	const fieldQueries = Array.from(queryFields, ([_, value]) => value).reduce(
		(fullQuery, { fieldName, gqlTypename, query }) => {
			switch (gqlTypename) {
				case aggregationsTypenames.Aggregations:
					return fullQuery + queryTemplateAggregations({ fieldName });
				case aggregationsTypenames.NumericAggregations:
					return fullQuery + queryTemplateNumericAggregations({ fieldName, variables: query.variables });
				default:
					console.log('Unsupported GQL typename found');
					return '';
			}
		},
		'',
	);

	const query = queryTemplateCharts({ documentType, fieldQueries });

	return query;
};

export const generateChartsQuery = ({
	documentType,
	queryFields,
}: {
	documentType: string;
	queryFields: Map<string, ChartAggregation>;
}): string | null => {
	if (queryFields.size === 0) {
		console.log('No query fields available');
		return null;
	}
	console.log(`Generating query for fields: ${queryFields}`);
	return generateQuery({ documentType, queryFields });
};
