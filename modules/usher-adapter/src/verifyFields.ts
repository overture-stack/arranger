import type { KeyRegistration } from '@overture-stack/usher-express-bridge';

type FieldLookup =
	| Readonly<{ kind: 'absent' }>
	| Readonly<{ kind: 'found'; type: unknown }>
	| Readonly<{ kind: 'nested'; path: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Finds `segments` in a mapping's properties, through plain objects, stopping at the first nested path. */
const lookUp = (properties: unknown, segments: readonly string[], prefix: string): FieldLookup => {
	const [segment, ...rest] = segments;
	const node =
		isRecord(properties) && segment !== undefined && Object.hasOwn(properties, segment)
			? properties[segment]
			: undefined;

	if (!isRecord(node) || segment === undefined) {
		return { kind: 'absent' };
	}

	const path = prefix ? `${prefix}.${segment}` : segment;

	if (node.type === 'nested') {
		return { kind: 'nested', path };
	}

	return rest.length === 0 ? { kind: 'found', type: node.type } : lookUp(node.properties, rest, path);
};

/** Why access cannot be enforced on `fieldName` in `mapping`, or undefined when it can. */
const fieldProblemOf = (mapping: unknown, fieldName: string): string | undefined => {
	const lookup = lookUp(mapping, fieldName.split('.'), '');

	switch (lookup.kind) {
		case 'absent':
			return `field "${fieldName}" is absent from its index mapping`;
		case 'nested':
			return `field "${fieldName}" lies inside the nested mapping "${lookup.path}", while the record is the unit of access`;
		case 'found':
			return lookup.type === 'keyword'
				? undefined
				: `field "${fieldName}" is not mapped as a keyword, so an exact match cannot enforce on it`;
	}
};

/**
 * Every reason access cannot be enforced on a catalogue as registered, against its index mapping as the
 * GraphQL router fetched it: each field the registration names must be a keyword, outside any nested
 * mapping, since the record is the unit of access. An open catalogue names no field. Each reason names
 * the catalogue and the field, both the operator's configuration.
 *
 * @param catalogueId the catalogue's key.
 * @param registration what the catalogue registers with the bridge.
 * @param mapping the catalogue's index mapping, its properties at the root.
 */
export const enforcementProblemsOf = (
	catalogueId: string,
	registration: KeyRegistration,
	mapping: unknown,
): string[] => {
	switch (registration.kind) {
		case 'open':
			return [];
		case 'artifact':
			return [`catalogue "${catalogueId}" registers an artifact key, which the adapter does not serve yet`];
		case 'record':
			return [registration.resourceFieldName, registration.categoryFieldName]
				.filter((fieldName): fieldName is string => fieldName !== undefined)
				.flatMap((fieldName) => {
					const problem = fieldProblemOf(mapping, fieldName);
					return problem ? [`catalogue "${catalogueId}": ${problem}`] : [];
				});
		default:
			// A registration is read from its file unvalidated, so its kind may be anything.
			return [`catalogue "${catalogueId}" registers a key of no kind the adapter serves`];
	}
};
