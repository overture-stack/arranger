/** Whether `value` is a plain object: not `null`, and not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks how deeply a JSON value nests, counting each object or array as one level.
 *
 * @remarks
 * Iterative, so a deeply nested value cannot overflow the stack this guards.
 *
 * @param value - Any JSON value.
 * @param maxDepth - The deepest level allowed; the root is level 0.
 * @returns `true` when `value` nests deeper than `maxDepth`.
 */
export const exceedsDepth = (value: unknown, maxDepth: number): boolean => {
	const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];

	for (let item = stack.pop(); item; item = stack.pop()) {
		if (item.depth > maxDepth) {
			return true;
		}
		if (typeof item.node === 'object' && item.node !== null) {
			for (const child of Object.values(item.node)) {
				stack.push({ node: child, depth: item.depth + 1 });
			}
		}
	}

	return false;
};
