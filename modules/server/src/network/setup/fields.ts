import { SUPPORTED_AGGREGATIONS_LIST, type SupportedAggregation } from '@/network/setup/constants';
import { type NodeConfig } from '@/network/setup/query';

type NetworkFieldType<T> = {
	name: string;
	type: T;
};
export type SupportedNetworkFieldType = NetworkFieldType<SupportedAggregation>;
type SupportedAggregations = SupportedNetworkFieldType[];
type UnsupportedAggregations = NetworkFieldType<string>[];

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
export const getFieldTypes = (fields: NodeConfig['aggregations']) => {
	const fieldTypes = fields.reduce(
		(
			aggregations: {
				supportedAggregations: SupportedAggregations;
				unsupportedAggregations: UnsupportedAggregations;
			},
			field,
		) => {
			if (isSupportedType(field, SUPPORTED_AGGREGATIONS_LIST)) {
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
 * Takes in all node aggregation field types and returns a single array.
 * - dedupes
 * - ensures types are supported
 *
 * @param nodeConfigs -
 * @returns Unique and supported aggregation field types.
 */
export const normalizeFieldTypes = (nodeConfigs: NodeConfig[]): SupportedNetworkFieldType[] => {
	// split into supported and unsupported types
	const nodeFieldTypes = nodeConfigs.map((config) => {
		const { supportedAggregations, unsupportedAggregations } = getFieldTypes(config.aggregations);

		return { supportedAggregations, unsupportedAggregations };
	});

	// flatten to single object
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
