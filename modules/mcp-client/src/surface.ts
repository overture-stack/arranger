import { createHash } from 'node:crypto';

import {
	type DiscoverResult,
	type ListPromptsResult,
	type ListResourcesResult,
	type ListResourceTemplatesResult,
	type ListToolsResult,
	type Prompt,
	type Resource,
	type ResourceTemplateType,
	type ServerCapabilities,
	type Tool,
} from '@modelcontextprotocol/client';

/**
 * What a server offers a model.
 *
 * @remarks
 * Built from named fields only, so result-level `_meta` (with the server's name and version), `ttlMs`,
 * `cacheScope` and `nextCursor` never enter it. Items keep their own `_meta`.
 */
export type SurfaceSnapshot = {
	supportedVersions: string[];
	capabilities: ServerCapabilities;
	instructions?: string;
	tools: Tool[];
	resources: Resource[];
	resourceTemplates: ResourceTemplateType[];
	prompts: Prompt[];
};

/** Raw SDK responses. Leave out a list the server does not advertise. */
export type RawSurface = {
	discover: Pick<DiscoverResult, 'supportedVersions' | 'capabilities' | 'instructions'>;
	tools?: Pick<ListToolsResult, 'tools'>;
	resources?: Pick<ListResourcesResult, 'resources'>;
	resourceTemplates?: Pick<ListResourceTemplatesResult, 'resourceTemplates'>;
	prompts?: Pick<ListPromptsResult, 'prompts'>;
};

/**
 * Builds a snapshot from raw SDK responses.
 *
 * @param raw - The `server/discover` result and the list results.
 * @returns The snapshot, with an empty list for each one left out.
 */
export const toSurfaceSnapshot = ({
	discover,
	tools,
	resources,
	resourceTemplates,
	prompts,
}: RawSurface): SurfaceSnapshot => ({
	supportedVersions: discover.supportedVersions,
	capabilities: discover.capabilities,
	...(discover.instructions !== undefined && { instructions: discover.instructions }),
	tools: tools?.tools ?? [],
	resources: resources?.resources ?? [],
	resourceTemplates: resourceTemplates?.resourceTemplates ?? [],
	prompts: prompts?.prompts ?? [],
});

/** Output still to write: either literal text, or a value still to serialize. */
type Pending = { text: string } | { value: unknown };

/** Iterative, so a deeply nested surface cannot overflow the stack while it is hashed. */
const canonicalJson = (root: unknown): string => {
	const output: string[] = [];
	const pending: Pending[] = [{ value: root }];

	for (let next = pending.pop(); next; next = pending.pop()) {
		if ('text' in next) {
			output.push(next.text);
			continue;
		}
		const { value } = next;
		const parts: Pending[] = [];
		if (Array.isArray(value)) {
			// List order is part of what the model sees, so it is kept.
			parts.push({ text: '[' });
			value.forEach((item, index) => {
				parts.push(...(index > 0 ? [{ text: ',' }] : []), { value: item === undefined ? null : item });
			});
			parts.push({ text: ']' });
		} else if (typeof value === 'object' && value !== null) {
			const entries = Object.entries(value)
				.filter(([, item]) => item !== undefined)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
			parts.push({ text: '{' });
			entries.forEach(([key, item], index) => {
				parts.push({ text: `${index > 0 ? ',' : ''}${JSON.stringify(key)}:` }, { value: item });
			});
			parts.push({ text: '}' });
		} else {
			output.push(JSON.stringify(value) ?? 'null');
			continue;
		}
		// Pushed in reverse, so the first part is popped first.
		for (let index = parts.length - 1; index >= 0; index -= 1) {
			pending.push(parts[index] as Pending);
		}
	}

	return output.join('');
};

/**
 * Serializes a snapshot canonically.
 *
 * @param snapshot - The snapshot to serialize.
 * @returns JSON with object keys sorted, list order kept, and `undefined` properties dropped.
 */
export const canonicalizeSurface = (snapshot: SurfaceSnapshot): string => canonicalJson(snapshot);

/**
 * Hashes a snapshot.
 *
 * @param snapshot - The snapshot to hash.
 * @returns The SHA-256 of {@link canonicalizeSurface}'s output, as lowercase hex.
 */
export const hashSurface = (snapshot: SurfaceSnapshot): string =>
	createHash('sha256').update(canonicalizeSurface(snapshot)).digest('hex');
