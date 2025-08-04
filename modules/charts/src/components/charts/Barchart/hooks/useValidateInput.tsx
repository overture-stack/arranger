import { fieldNameWithMapping } from '#components/Provider/hooks/useQueryFieldNames';
import { ArrangerAggregation } from '#shared';
import { useArrangerData } from '@overture-stack/arranger-components';

interface ChartAggregation {
	fieldName: string;
	gqlTypename: ArrangerAggregation;
	options: any;
}

const validateAggregationsType = ({ mappedFieldName, options }) => {
	const { gqlTypename } = mappedFieldName;
	if (gqlTypename === 'Aggregations' && options.range) {
		console.log('Aggregations typename does not support options');
		return false;
	}
	// success
	return { ...mappedFieldName, options };
};

const validateNumericAggregationsType = ({ mappedFieldName, options }) => {
	const { gqlTypename } = mappedFieldName;
	if (gqlTypename === 'NumericAggregations' && options.range === undefined) {
		console.log('NumericAggregations typename requires a provided "range" option');
		return false;
	}
	// success
	return { ...mappedFieldName, options };
};

export const useValidateInput = ({ fieldName, options }): ChartAggregation => {
	const { extendedMapping } = useArrangerData();
	const mappedFieldName = fieldNameWithMapping({ fieldName, extendedMapping });

	switch (mappedFieldName?.gqlTypename) {
		case 'Aggreagtions':
			return validateAggregationsType({ mappedFieldName, options });
		case 'NumericAggregations':
			return validateNumericAggregationsType({ mappedFieldName, options });
		default:
			return null;
	}
};
