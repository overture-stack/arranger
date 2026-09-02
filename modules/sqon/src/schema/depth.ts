/**
 * The deepest a SQON may nest before it is rejected, counted in raw JSON nesting rather than
 * combination levels. Raw nesting is what drives the parser's stack usage and runs at about twice
 * the combination count, so 500 permits roughly 250 nested combinations.
 *
 * Measured at default stack size: 750 combinations parse (18.8KB), 1000 throws `RangeError` out of
 * `safeParse`.
 *
 * TODO(review before merge): confirm this number as a team. 500 is deliberately permissive so the
 * guard cannot reject an existing caller while the limit is still open. 128 is defensible too:
 * still 10x any real query, but an order of magnitude below a ceiling that is stack-dependent
 * rather than constant, and so only accidentally safe at 500.
 */
export const SQON_MAX_DEPTH = 500;

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
		const { node, depth } = stack.pop() as { node: unknown; depth: number };

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
