import { fieldNameWithMapping } from '#components/Provider/hooks/useQueryFieldNames';
import { AggregationsTypename, aggregationsTypenames } from '#shared';
import { useArrangerData } from '@overture-stack/arranger-components';
import { BarChartPropsQuery } from '../Barchart';

export interface ChartAggregation {
	fieldName: string;
	gqlTypename: AggregationsTypename;
	query: BarChartPropsQuery;
}

const validateAggregationsType = ({ mappedFieldName, query }) => {
	if (query?.variables?.range) {
		console.log('Aggregations typename does not support options');
		return false;
	}
	// success
	return { ...mappedFieldName, query };
};

const validateNumericAggregationsType = ({ mappedFieldName, query }) => {
	if (query.variables.ranges === undefined) {
		console.log('NumericAggregations typename requires a provided "ranges" option');
		return false;
	}
	// success
	return { ...mappedFieldName, query };
};

// TODO: return success or failure
export const useValidateInput = ({ fieldName, query }): ChartAggregation => {
	const { extendedMapping } = useArrangerData();
	const mappedFieldName = fieldNameWithMapping({ fieldName, extendedMapping });

	switch (mappedFieldName?.gqlTypename) {
		case aggregationsTypenames.Aggregations:
			return validateAggregationsType({ mappedFieldName, query });
		case aggregationsTypenames.NumericAggregations:
			return validateNumericAggregationsType({ mappedFieldName, query });
		default:
			return false;
	}
};
