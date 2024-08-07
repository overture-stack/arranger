import { OperationDefinitionNode, print } from 'graphql';
import { NetworkAggregationConfig, SupportedNetworkFieldType } from './types';

/**
 * Returns an array of all field/type
 * @param configs
 * @returns Returns an array of all field/type
 */
export const getAllTypes = (configs: NetworkAggregationConfig[]): SupportedNetworkFieldType[] => {
	return configs.flatMap((config) => config.supportedAggregations);
};

/**
 * GraphQL AST => String
 */
export const ASTtoString = (ast: OperationDefinitionNode) => {
	return print(ast);
};
