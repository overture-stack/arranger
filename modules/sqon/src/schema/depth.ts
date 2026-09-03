/**
 * Maximum depth for a SQON before it is rejected, counted in raw JSON nesting rather than
 * combination levels (roughly twice the combination count, so 128 allows 62).
 *
 * Without a cap, a deeply nested SQON overflows the recursive parse and escapes `safeParse` as a
 * `RangeError`, which it is documented never to throw. The overflow point depends on the runtime
 * and its stack size, so this sits well below any observed one rather than close to it.
 */
export const SQON_MAX_DEPTH = 128;

/**
 * Iterative, not recursive: a recursive walk would hit the same stack limit this exists to prevent.
 *
 * @param value - Any value, typically an unvalidated SQON from a request.
 * @param maxDepth - Defaults to {@link SQON_MAX_DEPTH}.
 * @returns `true` when `value` nests no deeper than `maxDepth`.
 */
export const checkSqonDepth = (value: unknown, maxDepth: number = SQON_MAX_DEPTH): boolean => {
	const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];

	while (stack.length > 0) {
		const item = stack.pop();

		if (!item) {
			break;
		}

		const { node, depth } = item;

		if (depth > maxDepth) {
			return false;
		}

		if (Array.isArray(node)) {
			for (const child of node) {
				stack.push({ node: child, depth: depth + 1 });
			}
		} else if (node && typeof node === 'object') {
			for (const child of Object.values(node)) {
				stack.push({ node: child, depth: depth + 1 });
			}
		}
	}

	return true;
};
