import { getGQLTypename } from '#arranger/mapping';
import { logger } from '#logger';
import { failure, Result, success } from '#result';
import { AggregationsTypename, aggregationsTypenames } from '#shared';
import { ExtendedMappingInterface } from '@overture-stack/arranger-components';

export interface ValidatedProps {
	fieldName: string;
	gqlTypename: AggregationsTypename;
	variables?: any;
}

export interface ValidationResult {}

const validateAggregationsType = (queryProps): Result<ValidatedProps> => {
	if (queryProps?.variables?.range) {
		const message = 'Aggregations typename does not support options';
		logger.log(message);
		return failure(message);
	}
	return success(queryProps);
};

const validateNumericAggregationsType = (queryProps): Result<ValidatedProps> => {
	if (queryProps.variables.ranges === undefined) {
		const message = 'NumericAggregations typename requires a provided "ranges" option';
		logger.log(message);
		return failure(message);
	}
	return success(queryProps);
};

//interface ValidationInput extends Pick<BarChartProps, 'fieldName'> & {extendedM}
interface A {
	fieldName: string;
	variables: any;
	extendedMapping: ExtendedMappingInterface[];
}
export const validateQueryProps = ({ fieldName, variables, extendedMapping }: A): Result<ValidatedProps> => {
	// add GQL typename to object
	const gqlTypename = getGQLTypename({ fieldName, extendedMapping });
	const queryProps = { fieldName, variables, gqlTypename };

	switch (queryProps.gqlTypename) {
		case aggregationsTypenames.Aggregations:
			return validateAggregationsType(queryProps);
		case aggregationsTypenames.NumericAggregations:
			return validateNumericAggregationsType(queryProps);
		default:
			return failure(`Could not validate configuration: ${JSON.stringify(queryProps)}`);
	}
};
