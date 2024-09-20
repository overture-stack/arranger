import { SupportedAggregation } from '../common';
import { GQLFieldType } from '../queries';
import {
	NetworkFieldType,
	SupportedAggregations,
	SupportedNetworkFieldType,
	UnsupportedAggregations,
} from '../types/types';

export type NetworkFields = { name: string; fields: GQLFieldType[] };

const isSupportedType = (
	fieldObject: NetworkFieldType<string>,
	supportedList: string[],
): fieldObject is SupportedNetworkFieldType => {
	return supportedList.includes(fieldObject.type);
};

/**
 * Parse network fields into supported and unsupported
 *
 * @param fields
 * @returns { supportedAggregations: [], unsupportedAggregations: [] }
 */
export const getFieldTypes = (
	fields: GQLFieldType[],
	supportedAggregationsList: SupportedAggregation[],
) => {
	const fieldTypes = fields.reduce(
		(
			aggregations: {
				supportedAggregations: SupportedAggregations;
				unsupportedAggregations: UnsupportedAggregations;
			},
			field,
		) => {
			const fieldType = field.type.name;
			const fieldObject = { name: field.name, type: fieldType };
			if (isSupportedType(fieldObject, supportedAggregationsList)) {
				return {
					...aggregations,
					supportedAggregations: aggregations.supportedAggregations.concat(fieldObject),
				};
			} else {
				return {
					...aggregations,
					unsupportedAggregations: aggregations.unsupportedAggregations.concat(fieldObject),
				};
			}
		},
		{
			supportedAggregations: [],
			unsupportedAggregations: [],
		},
	);

	return fieldTypes;
};

export const getAllFieldTypes = (
	networkFields: NetworkFields[],
	supportedTypes: SupportedAggregation[],
) => {
	const nodeFieldTypes = networkFields.map((networkField) => {
		const { supportedAggregations, unsupportedAggregations } = getFieldTypes(
			networkField.fields,
			supportedTypes,
		);

		return { supportedAggregations, unsupportedAggregations };
	});

	return nodeFieldTypes.flatMap((fieldType) => fieldType.supportedAggregations);
};
