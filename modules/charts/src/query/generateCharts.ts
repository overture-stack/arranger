import { ChartConfig } from '#components/charts/BarChart/useValidateInput';
import { queryTemplateAggregations, queryTemplateNumericAggregations } from '#gql';
import { logger } from '#logger';
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

// ugly - works for small query templating, improvement: use gql builder
const generateQuery = ({
	documentType,
	queryFields,
}: {
	documentType: string;
	queryFields: Map<string, ChartConfig>;
}) => {
	const fieldQueries = Array.from(queryFields, ([_, value]) => value).reduce(
		(fullQuery, { fieldName, gqlTypename, query }) => {
			switch (gqlTypename) {
				case aggregationsTypenames.Aggregations:
					return fullQuery + queryTemplateAggregations({ fieldName });
				case aggregationsTypenames.NumericAggregations:
					return fullQuery + queryTemplateNumericAggregations({ fieldName, variables: query.variables });
				default:
					logger.log('Unsupported GQL typename found');
					return '';
			}
		},
		'',
	);

	const query = queryTemplateCharts({ documentType, fieldQueries });

	return query;
};

/**
 * Generate single GQL query for all charts under a single ChartsProvider
 *
 * @param param0
 * @returns
 */
export const generateChartsQuery = ({
	documentType,
	queryFields,
}: {
	documentType: string;
	queryFields: Map<string, ChartConfig>;
}): string | null => {
	if (queryFields.size === 0) {
		logger.log('No query fields available');
		return null;
	}
	logger.log(`Generating query for fields: ${queryFields}`);
	return generateQuery({ documentType, queryFields });
};
