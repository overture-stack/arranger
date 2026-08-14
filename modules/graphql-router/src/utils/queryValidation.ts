import { GraphQLError, type ValidationRule } from 'graphql';

/**
 * Rejects queries that use more aliases than `limit`.
 * Defends against alias-overloading DoS where an attacker batches hundreds of
 * expensive Elasticsearch aggregations into a single HTTP request.
 */
export const maxAliasesRule =
	(limit = 15): ValidationRule =>
	(context) => {
		let aliasCount = 0;
		return {
			Field(node) {
				if (node.alias) aliasCount++;
			},
			Document: {
				leave() {
					if (aliasCount > limit) {
						context.reportError(
							new GraphQLError(
								`Query alias limit exceeded: found ${aliasCount} aliases, maximum allowed is ${limit}.`,
							),
						);
					}
				},
			},
		};
	};

/**
 * Rejects queries whose field nesting exceeds `limit`.
 * Complements maxAliasesRule by capping the cost of each individual field path.
 * Introspection is exempt: it's served from the in-memory schema with no Elasticsearch cost, so
 * counting its depth only breaks tooling (e.g. GraphQL Playground/Sandbox, whose own
 * schema-fetching query is inherently deep due to nested `ofType` wrapping) without adding any
 * real protection. Checking the field's parent type (not just its own name) is required: the
 * standard introspection query's `TypeRef` fragment is `on __Type`, a separate top-level
 * fragment definition rather than something nested under a `__schema`/`__type` field, so a
 * name-only check on the field itself never sees it.
 */
export const maxDepthRule =
	(limit = 7): ValidationRule =>
	(context) => {
		let depth = 0;
		const isIntrospectionField = (node: { name: { value: string } }) =>
			node.name.value.startsWith('__') || Boolean(context.getParentType()?.name.startsWith('__'));

		return {
			Field: {
				enter(node) {
					if (isIntrospectionField(node)) return false;

					depth++;
					if (depth > limit) {
						context.reportError(
							new GraphQLError(
								`Query depth limit exceeded: current depth ${depth} exceeds maximum of ${limit}.`,
							),
						);
					}
					return undefined;
				},
				leave(node) {
					if (!isIntrospectionField(node)) depth--;
				},
			},
		};
	};
