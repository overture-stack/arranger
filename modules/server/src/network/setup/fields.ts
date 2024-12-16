import { GQLFieldType } from '../queries';
import {
	NodeConfig,
	SupportedAggregations,
	SupportedNetworkFieldType,
	UnsupportedAggregations,
} from '../types/types';
import { SUPPORTED_AGGREGATIONS_LIST } from './constants';

export type NetworkFields = { name: string; fields: GQLFieldType[] };

/**
 * Parse network fields into supported and unsupported
 *
 * @param fields
 * @returns { supportedAggregations: [], unsupportedAggregations: [] }
 */
export const getFieldTypes = (fields: NodeConfig['aggregations']) => {
	const fieldTypes = fields.reduce(
		(
			aggregations: {
				supportedAggregations: SupportedAggregations;
				unsupportedAggregations: UnsupportedAggregations;
			},
			field,
		) => {
			const isAggregationTypeSupported = SUPPORTED_AGGREGATIONS_LIST.includes(field.type);
			if (isAggregationTypeSupported) {
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

/**
 *
 * @param nodeConfigs
 * @param supportedTypes
 * @returns unique fields
 */
export const getAllFieldTypes = (nodeConfigs: NodeConfig[]): SupportedNetworkFieldType[] => {
	const nodeFieldTypes = nodeConfigs.map((config) => {
		const { supportedAggregations, unsupportedAggregations } = getFieldTypes(config.aggregations);

		return { supportedAggregations, unsupportedAggregations };
	});

	const allSupportedAggregations = nodeFieldTypes.flatMap(
		(fieldType) => fieldType.supportedAggregations,
	);

	/*
	 * Returns unique fields
	 * eg. if NodeA and NodeB both have `analysis__analysis__id`, only include it once
	 * This is during server startup for creating the Apollo server.
	 * Please do not use expensive stringify and parsing for server queries.
	 */
	const uniqueSupportedAggregations = Array.from(
		new Set(allSupportedAggregations.map((nodeField) => JSON.stringify(nodeField))),
	).map((nodeFieldString) => JSON.parse(nodeFieldString));
	return uniqueSupportedAggregations;
};
