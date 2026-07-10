/** One edge of an Arranger GraphQL hits connection. */
export type ArrangerHitsEdge = { node?: Record<string, unknown> };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Extracts the edges array from the connection value Arranger returns for a `nested`
 * field within a hit node (`{ hits: { edges: [{ node }] } }`).
 */
const getConnectionEdges = (value: Record<string, unknown>): ArrangerHitsEdge[] => {
	const hits = value.hits;
	return isPlainObject(hits) && Array.isArray(hits.edges) ? (hits.edges as ArrangerHitsEdge[]) : [];
};

/**
 * Compacts one hit node: `nested` fields arrive wrapped in the GraphQL connection shape
 * and are flattened to plain arrays of their (recursively compacted) nodes; `object`
 * fields are traversed in place; all other values pass through unchanged.
 */
const compactNode = (
	node: Record<string, unknown>,
	fieldTypes: Record<string, string>,
	parentPath: string,
): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(node).map(([key, value]) => {
			const path = parentPath ? `${parentPath}.${key}` : key;

			if (fieldTypes[path] === 'nested' && isPlainObject(value)) {
				return [
					key,
					getConnectionEdges(value).map((edge) =>
						compactNode(isPlainObject(edge?.node) ? edge.node : {}, fieldTypes, path),
					),
				];
			}

			if (Array.isArray(value)) {
				return [key, value.map((item) => (isPlainObject(item) ? compactNode(item, fieldTypes, path) : item))];
			}

			if (isPlainObject(value)) {
				return [key, compactNode(value, fieldTypes, path)];
			}

			return [key, value];
		}),
	);

/**
 * Strips the GraphQL `edges`/`node` nesting from an Arranger hits response, including the
 * connection wrappers that `nested` fields carry inside each hit node.
 * @param edges - The `hits.edges` array from an Arranger GraphQL response.
 * @param fieldTypes - Map of dot-notation field name to its introspected field type.
 * @returns One flat document object per hit.
 * @remarks This makes the response easier to work with for LLMs.
 * @example
 * ```ts
 * compactHitNodes({
 * 	edges: [{ node: { id: 'f1', donors: { hits: { edges: [{ node: { age: 41 } }] } } } }],
 * 	fieldTypes: { donors: 'nested', 'donors.age': 'long' },
 * })
 * // returns [{ id: 'f1', donors: [{ age: 41 }] }]
 * ```
 */
export const compactHitNodes = ({
	edges,
	fieldTypes,
}: {
	edges: ArrangerHitsEdge[];
	fieldTypes: Record<string, string>;
}): Record<string, unknown>[] => edges.map((edge) => compactNode(edge.node ?? {}, fieldTypes, ''));
