import { isGroupNode } from '#builder/utils.js';
import type { SqonCombinationOp } from '#operators/index.js';
import type { SqonCombination, SqonNode } from '#schema/index.js';

/**
 * Wraps `node` in a combination if it isn't already one. An already-combination node is returned
 * unchanged, regardless of `op`. Unlike `SqonBuilder`, this never collapses a single-item
 * combination back to its sole child, so the result's `content` is always an array.
 */
export const asCombination = (node: SqonNode, op: SqonCombinationOp = 'and'): SqonCombination =>
	isGroupNode(node) ? node : { op, content: [node] };
