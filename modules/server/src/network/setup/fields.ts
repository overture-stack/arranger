import { SupportedAggregation } from '../common';
import { GQLFieldType } from '../queries';
import {
	NetworkFieldType,
	NodeConfig,
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
	fields: NodeConfig['aggregations'],
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
			if (isSupportedType(field, supportedAggregationsList)) {
				return {
					...aggregations,
					supportedAggregations: aggregations.supportedAggregations.concat(field),
				};
			} else {
				return {
					...aggregations,
					unsupportedAggregations: aggregations.unsupportedAggregations.concat(field),
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
	nodeConfigs: NodeConfig[],
	supportedTypes: SupportedAggregation[],
) => {
	const nodeFieldTypes = nodeConfigs.map((config) => {
		const { supportedAggregations, unsupportedAggregations } = getFieldTypes(
			config.aggregations,
			supportedTypes,
		);

		return { supportedAggregations, unsupportedAggregations };
	});
	console.log('n', nodeFieldTypes);
	const allSupportedAggregations = nodeFieldTypes.flatMap(
		(fieldType) => fieldType.supportedAggregations,
	);
	/*
	 * Returns unique fields
	 * eg. if NodeA and NodeB both have `analysis__analysis__id`, only include it once
	 * This during server startup for creating the Apollo server.
	 * Please do not use expensive stringify and parsing for server queries.
	 */
	const uniqueSupportedAggregations = Array.from(
		new Set(allSupportedAggregations.map((nodeField) => JSON.stringify(nodeField))),
	).map((nodeFieldString) => JSON.parse(nodeFieldString));
	return uniqueSupportedAggregations;
};
