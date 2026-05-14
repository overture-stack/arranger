import { type DocumentNode, type GraphQLResolveInfo, print } from 'graphql';
import graphqlFields from 'graphql-fields';

/*
 * GraphQL AST => String
 */
export const ASTtoString = (ast: DocumentNode) => {
	return print(ast);
};

export type RequestedFieldsMap = Record<string, object>;

/**
 * Turns GraphQLResolveInfo into an object the requested fields
 *
 * @param info GQL request info object
 */
export const resolveInfoToMap = (info: GraphQLResolveInfo, key: string): RequestedFieldsMap => {
	const requestedFields = graphqlFields(info);
	const aggregations = requestedFields[key] || {};

	// ensure __typename will be queried to network nodes
	const aggs = Object.keys(aggregations).reduce((aggs, key) => {
		const element = aggregations[key];

		if (element.__typename === undefined) {
			element['__typename'] = {};
		}

		return { ...aggs, [key]: element };
	}, {});
	return aggs;
};
