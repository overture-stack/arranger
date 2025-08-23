import { useArrangerData } from '@overture-stack/arranger-components';

import { fieldNameWithMapping } from '#arranger/mapping';
import { logger } from '#logger';
import { AggregationsTypename, aggregationsTypenames } from '#shared';
import { BarChartPropsQuery } from './Barchart';

export type ValidationInput = {
	fieldName: string;
	query: BarChartPropsQuery;
};
export type ChartConfig = ValidationInput & {
	gqlTypename: AggregationsTypename;
};

const validateAggregationsType = ({ mappedFieldName, query }) => {
	if (query?.variables?.range) {
		logger.debug('Aggregations typename does not support options');
		return false;
	}
	// success
	return { ...mappedFieldName, query };
};

const validateNumericAggregationsType = ({ mappedFieldName, query }) => {
	if (query.variables.ranges === undefined) {
		logger.debug('NumericAggregations typename requires a provided "ranges" option');
		return false;
	}
	// success
	return { ...mappedFieldName, query };
};

/**
 * Custom hook that validates chart input parameters and returns aggregation configuration.
 * Checks field mapping compatibility and validates query options based on data type.
 *
 * @param { fieldName } - GraphQL field name to validate
 * @param { query } - Query configuration with optional variables
 * @returns Valid chart aggregation configuration or false if validation fails
 */
export const useValidateInput = ({ fieldName, query }: ValidationInput): ChartConfig | null => {
	const { extendedMapping } = useArrangerData();
	const mappedFieldName = fieldNameWithMapping({ fieldName, extendedMapping });

	switch (mappedFieldName?.gqlTypename) {
		case aggregationsTypenames.Aggregations:
			return validateAggregationsType({ mappedFieldName, query });
		case aggregationsTypenames.NumericAggregations:
			return validateNumericAggregationsType({ mappedFieldName, query });
		default:
			return null;
	}
};
