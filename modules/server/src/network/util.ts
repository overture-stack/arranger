import { DocumentNode, print } from 'graphql';
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
