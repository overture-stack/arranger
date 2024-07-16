// environment config
export type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	displayName: string;
};

/**
 * Complete aggregation config that defines the network search setup.
 * This includes the original config information plus computed fields
 * that are generated in the network search initialization process.
 */
export type NetworkAggregationConfig = NetworkAggregationConfigInput & {
	availableAggregations?: NetworkFieldType[];
};

export type NetworkFieldType = {
	name: string;
	type: string;
};
