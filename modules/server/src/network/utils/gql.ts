import { type DocumentNode, type GraphQLResolveInfo, print } from 'graphql';
import graphqlFields from 'graphql-fields';

/*
 * GraphQL AST => String
 */
export const ASTtoString = (ast: DocumentNode) => {
	return print(ast);
};

/**
 * Turns GraphQLResolveInfo into a map of the requested fields
 *
 * @param info GQL request info object
 * @example
 * ```
 * {
 *   analysis__analysis_state: {
 *   	bucket_count: {},
 *   	buckets: {
 * 			key: {},
 * 			doc_count: {}
 * 		},
 *    __typename: {}
 * }
 * ```
 */
export type RequestedFieldsMap = Record<string, {}>;
export const resolveInfoToMap = (info: GraphQLResolveInfo, key: string): RequestedFieldsMap => {
	const requestedFields = graphqlFields(info);
	const aggregations = requestedFields[key];

	// ensure __typename will be queried to network nodes
	const aggs = Object.keys(aggregations).reduce((aggs, key) => {
		const element = aggregations[key];
		if (!element.hasOwnProperty('__typename')) {
			element['__typename'] = {};
		}
		return { ...aggs, [key]: element };
	}, {});
	return aggs;
};
