import { aggregationsTypenames } from '#arranger';
import { queryTemplateAggregations, queryTemplateNumericAggregations } from '#gql';
import { logger } from '#logger';
import type { ChartQuery } from '../components/Provider/chartsContextTypes';

const queryTemplateCharts = ({
	disableIncludeMissing = false,
	documentType,
	fieldQueries,
	networkFieldQueries,
	isRequireNetworkSearch,
}: {
	disableIncludeMissing?: boolean;
	documentType: string;
	fieldQueries?: string;
	networkFieldQueries?: string;
	isRequireNetworkSearch: boolean;
}) => {
	const networkAggregations = networkFieldQueries
		? `aggregations {
    ${networkFieldQueries}
  }`
		: '';

	// Add a network query if it is set as required, or if we have networkFieldQueries to add.
	// network search will always return all nodes info
	const isNetworkQuery = Boolean(isRequireNetworkSearch || networkFieldQueries);
	const networkQuery = isNetworkQuery
		? `network (filters: $filters, nodesFilter: $nodesFilter, aggregations_filter_themselves: true) {
  ${networkAggregations}
  nodes {
    hits
    name
    nodeId
    errors
    status
  }
}`
		: '';

	const localQuery = fieldQueries
		? `${documentType} {
        aggregations(
          filters: $filters
          include_missing: ${!disableIncludeMissing}
          aggregations_filter_themselves: true
        ) {
         ${fieldQueries}
        }
      }`
		: '';

	// $nodesFilter is only declared when the network query is present - an unused
	// operation variable fails GraphQL validation (NoUnusedVariablesRule).
	const operationVariables = isNetworkQuery ? '$filters: JSON, $nodesFilter: [String]' : '$filters: JSON';
	return `query ChartsQuery(${operationVariables}) {
      ${localQuery}
      ${networkQuery}
    }`;
};

/**
 * Generate single GQL query for all charts under a single ChartsProvider.
 * Inlines variables to simplify, instead of passing as reference in query and seperately in query body
 *
 * This will include aggregations for the specified `documentType` if `queryFields` are provided.
 *
 * If `networkQueryFields` are provided or `isRequireNetworkSearch` is set to true, then a network query will be generated.
 * `network.nodes` will be queries for any network search, but `network.aggregations` will only be included if `networkQueryFields`
 * has a value.
 *
 * This query expects that a value for `filters` will be passed with the query variables. `filters` should be a JSON value with a valid SQON.
 * When network query is used, the query requires a `nodesFilter` value be included with the query variables. `nodesFilter` should be an array of strings,
 * with each string containing a remote node's nodeId.
 */
export const generateChartsQuery = ({
	disableIncludeMissing,
	documentType,
	queryFields,
	networkQueryFields,
	isRequireNetworkSearch,
}: {
	disableIncludeMissing?: boolean;
	documentType: string;
	queryFields: Map<string, ChartQuery>;
	networkQueryFields: Map<string, ChartQuery>;
	isRequireNetworkSearch: boolean;
}): string | null => {
	if (queryFields.size === 0 && networkQueryFields.size === 0 && !isRequireNetworkSearch) {
		logger.debug('No charts query to generate - no data has been requested');
		return null;
	}
	logger.debug(`Generating query for fields: ${JSON.stringify(queryFields)}`);

	// TODO: use gql builder, this is ugly but works for small query templating
	const fieldQueries = Array.from(queryFields.values()).reduce((fullQuery, query) => {
		const { fieldName, gqlTypename, variables } = query;

		switch (gqlTypename) {
			case aggregationsTypenames.Aggregations:
				return fullQuery + queryTemplateAggregations({ fieldName });
			case aggregationsTypenames.NumericAggregations:
				return fullQuery + queryTemplateNumericAggregations({ fieldName, variables });
			default:
				logger.debug('Unsupported GQL typename found');
				return fullQuery;
		}
	}, '');

	const networkFieldQueries = Array.from(networkQueryFields.values()).reduce((fullQuery, fieldQuery) => {
		const { fieldName } = fieldQuery;
		return fullQuery + queryTemplateAggregations({ fieldName });
	}, '');

	const query = queryTemplateCharts({
		disableIncludeMissing,
		documentType,
		fieldQueries,
		networkFieldQueries,
		isRequireNetworkSearch,
	});
	return query;
};
