import { type SUPPORTED_AGGREGATIONS, SUPPORTED_AGGREGATIONS_LIST } from '#network/setup/constants.js';

import partitionArray from '../../utils/partitionArray.js';
import type { AggregationField, NetworkRemoteNode } from '../types/setup.js';

export type SupportedAggregationField = AggregationField & { type: (typeof SUPPORTED_AGGREGATIONS)['Aggregations'] };

export const isFieldAggregationSupported = (
	fieldObject: AggregationField,
): fieldObject is SupportedAggregationField => {
	return SUPPORTED_AGGREGATIONS_LIST.includes(fieldObject.type);
};

/**
 * Parse network fields into supported and unsupported aggregations.
 *
 * @param fields
 * @returns { supportedAggregations: [], unsupportedAggregations: [] }
 */
export const partitionSupportedAggregations = (
	fields: NetworkRemoteNode['aggregations'],
): { supportedAggregations: SupportedAggregationField[]; unsupportedAggregations: AggregationField[] } => {
	const [supportedAggregations, unsupportedAggregations] = partitionArray<
		SupportedAggregationField,
		AggregationField
	>(fields, isFieldAggregationSupported);

	return { supportedAggregations, unsupportedAggregations };
};

/**
 * Takes in all node aggregation field types and returns a single array.
 * - dedupes
 * - ensures types are supported
 *
 * @param nodeConfigs -
 * @returns Unique and supported aggregation field types.
 */
export const combineAllFieldTypes = (nodeConfigs: NetworkRemoteNode[]): SupportedAggregationField[] => {
	// split into supported and unsupported types
	const allSupportedAggregations = nodeConfigs.flatMap(
		(config) => partitionSupportedAggregations(config.aggregations).supportedAggregations,
	);

	/*
	 * Returns unique fields
	 * eg. if NodeA and NodeB both have `analysis__analysis__id`, only include it once
	 * This is during server startup for creating the Apollo server.
	 * Please do not use expensive stringify and parsing for server queries.
	 *
	 * TODO: edge case, this is possible to still have duplicates do to difference in ordering of properties between two AggregationFields.
	 */
	const uniqueSupportedAggregations = Array.from(
		new Set(allSupportedAggregations.map((nodeField) => JSON.stringify(nodeField))),
	).map((nodeFieldString) => JSON.parse(nodeFieldString));

	return uniqueSupportedAggregations;
};
