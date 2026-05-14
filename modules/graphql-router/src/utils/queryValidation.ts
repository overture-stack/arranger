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
 */
export const maxDepthRule =
	(limit = 7): ValidationRule =>
	(context) => {
		let depth = 0;
		return {
			Field: {
				enter() {
					depth++;
					if (depth > limit) {
						context.reportError(
							new GraphQLError(
								`Query depth limit exceeded: current depth ${depth} exceeds maximum of ${limit}.`,
							),
						);
					}
				},
				leave() {
					depth--;
				},
			},
		};
	};
