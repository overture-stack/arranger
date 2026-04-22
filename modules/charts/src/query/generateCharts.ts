import { aggregationsTypenames } from '#arranger';
import { Query } from '#components/Provider/useQueryFieldNames';
import { queryTemplateAggregations, queryTemplateNumericAggregations } from '#gql';
import { logger } from '#logger';

const queryTemplateCharts = ({ disableIncludeMissing = false, documentType, fieldQueries }) => {
	return `query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: ${!disableIncludeMissing}
          aggregations_filter_themselves: true
        ) {
         ${fieldQueries}
        }
      }
    }`;
};

// ugly - works for small query templating, improvement: use gql builder
const generateQuery = ({
	disableIncludeMissing,
	documentType,
	queryFields,
}: {
	disableIncludeMissing?: boolean;
	documentType: string;
	queryFields: Map<string, Query>;
}) => {
	const fieldQueries = Array.from(queryFields, ([_, value]) => value).reduce(
		(fullQuery, { fieldName, gqlTypename, variables }) => {
			switch (gqlTypename) {
				case aggregationsTypenames.Aggregations:
					return fullQuery + queryTemplateAggregations({ fieldName });
				case aggregationsTypenames.NumericAggregations:
					return fullQuery + queryTemplateNumericAggregations({ fieldName, variables });
				default:
					logger.debug('Unsupported GQL typename found');
					return '';
			}
		},
		'',
	);

	const query = queryTemplateCharts({ disableIncludeMissing, documentType, fieldQueries });

	return query;
};

/**
 * Generate single GQL query for all charts under a single ChartsProvider
 * Inlines variables to simplify, instead of passing as reference in query and seperately in query body
 */
export const generateChartsQuery = ({
	disableIncludeMissing,
	documentType,
	queryFields,
}: {
	disableIncludeMissing?: boolean;
	documentType: string;
	queryFields: Map<string, Query>;
}): string | null => {
	if (queryFields.size === 0) {
		logger.debug('No query fields available');
		return null;
	}
	logger.debug(`Generating query for fields: ${JSON.stringify(queryFields)}`);
	return generateQuery({ disableIncludeMissing, documentType, queryFields });
};
