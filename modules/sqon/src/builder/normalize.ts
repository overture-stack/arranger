import { normalizeSqonOp } from '#operators/index.js';
import type { SqonAcceptedOp } from '#operators/index.js';
import { isGroupNode } from '#builder/utils.js';
import type { SqonNode } from '#schema/index.js';

/**
 * Recursively normalizes every leaf's `op` to its canonical form (e.g. `=` -> `in`, `filter` -> `wildcard`).
 * Combination nodes (`and`/`or`/`not`) have no operator aliases and are only recursed into.
 */
export const normalizeSqonNode = (node: SqonNode): SqonNode => {
	if (isGroupNode(node)) {
		return { ...node, content: node.content.map(normalizeSqonNode) };
	}

	return { ...node, op: normalizeSqonOp(node.op as SqonAcceptedOp) } as unknown as SqonNode;
};
