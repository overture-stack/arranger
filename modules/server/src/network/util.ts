import { DocumentNode, GraphQLResolveInfo, print } from 'graphql';
import graphqlFields from 'graphql-fields';
import { NetworkAggregationConfig, SupportedNetworkFieldType } from './types';

/**
 * Returns an array of all field/type
 * @param configs
 * @returns Returns an array of all field/type
 */
export const getAllTypes = (configs: NetworkAggregationConfig[]): SupportedNetworkFieldType[] => {
	return configs.flatMap((config) => config.supportedAggregations);
};

/*
 * GraphQL AST => String
 */
export const ASTtoString = (ast: DocumentNode) => {
	return print(ast);
};

/**
 * Type guard to filter fulfilled Promises
 */
export const fulfilledPromiseFilter = <Result>(result: unknown): result is Result => {
	return (
		typeof result === 'object' &&
		result !== null &&
		'status' in result &&
		result.status === 'fulfilled'
	);
};

/**
 * Returns requested fields
 *
 * @param info GQL request info object
 * @returns
 */
export const getRequestedFields = (info: GraphQLResolveInfo) => {
	const requestedFields = graphqlFields(info);
	return { requestedAggregations: Object.keys(requestedFields.aggregations) };
};
