import { GraphQLSchema } from 'graphql';

// environment config
export type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	displayName: string;
};

// additional properties after initialising network
export type NetworkAggregationConfig = NetworkAggregationConfigInput & {
	schema: GraphQLSchema | undefined;
};
