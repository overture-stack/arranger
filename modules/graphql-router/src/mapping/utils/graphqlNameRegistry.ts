import { sanitizeGraphqlFlatName, sanitizeGraphqlNameSegment } from '@overture-stack/arranger-types/tools';

/** Two or more distinct raw field paths under the same parent that sanitize to the same GraphQL name; sanitization alone can't resolve this. */
export type GraphqlNameCollision = {
	/** The GraphQL name every path in `rawPaths` collided on. */
	graphqlName: string;
	/** Dotted path to the shared parent (empty string for a top-level collision). */
	parentPath: string;
	/** Every raw field path that sanitizes to `graphqlName` under this parent. */
	rawPaths: string[];
};

export type GraphqlNameRegistry = {
	/** Every collision found; empty when every sanitized name is unique within its parent. */
	collisions: GraphqlNameCollision[];
	/** The catalogue's document type name, sanitized. */
	documentType: string;
	/**
	 * Plain-object snapshot of every raw path's sanitized leaf name, for callers (e.g. the worker
	 * threads `resolveHits.js` spawns) that need a serializable lookup rather than this registry's
	 * own `toGraphqlLeafName` function, which can't cross a worker-thread boundary.
	 */
	leafNamesByPath: Record<string, string>;
	/**
	 * Inverse of the flat aggregation name: sanitized whole-path name to raw dotted ES path (e.g.
	 * `qc_metrics__batch_id` to `qc-metrics.batch-id`). Aggregations key their whole path into one
	 * GraphQL name, so recovering the ES path needs the whole path back, not a leaf.
	 *
	 * Collision detection covers sanitized *leaves* within a shared parent, which is a different
	 * space from this one: a literal `a.b__c` and a nested `a.b.c` both flatten to `a__b__c` without
	 * being siblings, so nothing rejects them at build time. Rare, and tracked separately.
	 */
	rawPathsByGraphqlFlatName: Record<string, string>;
	/**
	 * Inverse of the top-level GraphQL name: sanitized name to raw ES name, for root fields only
	 * (e.g. `qc_metrics` to `qc-metrics`). That is the whole space `_source` needs, since including
	 * a raw object path pulls its children with it.
	 */
	rawTopLevelNamesByGraphqlName: Record<string, string>;
	/** The GraphQL leaf name for a field, given its full dotted raw path (e.g. `biomarker.ca19-9_level`). */
	toGraphqlLeafName: (rawPath: string) => string;
};

/**
 * A no-collision-detection fallback for schema types that aren't built from a catalogue's own
 * mapping (e.g. the fixed, hardcoded "Sets" type every catalogue gets alongside its document
 * type), so callers can always assume a registry is present without every builder needing to
 * special-case "no registry was given" itself. Sanitizes on the fly, per field, matching what a
 * per-catalogue registry falls back to for a path it never saw.
 */
export const identityGraphqlNameRegistry: GraphqlNameRegistry = {
	collisions: [],
	documentType: '',
	leafNamesByPath: {},
	rawPathsByGraphqlFlatName: {},
	rawTopLevelNamesByGraphqlName: {},
	toGraphqlLeafName: (rawPath: string) => sanitizeGraphqlNameSegment(rawPath.split('.').pop() ?? rawPath),
};

/**
 * Builds the raw-to-sanitized GraphQL name translation for one catalogue, once, so every schema
 * builder and the hit resolver ask the same registry instead of each independently re-deriving
 * sanitization (and risking drift between them). The sanitization rule itself lives in
 * `@overture-stack/arranger-types/tools` (shared with the UI packages); this registry adds the
 * per-catalogue, per-parent collision detection sanitization alone can't provide.
 */
export const buildGraphqlNameRegistry = ({
	documentType,
	fieldsFromMapping,
}: {
	documentType: string;
	fieldsFromMapping: { fieldName: string }[];
}): GraphqlNameRegistry => {
	const leafByPath = new Map<string, string>();
	const rawPathByFlatName = new Map<string, string>();
	const rawTopLevelByName = new Map<string, string>();
	const siblingsByParent = new Map<string, { rawPath: string; sanitizedLeaf: string }[]>();

	fieldsFromMapping.forEach(({ fieldName: rawPath }) => {
		const segments = rawPath.split('.');
		const rawLeaf = segments[segments.length - 1] ?? rawPath;
		const parentPath = segments.slice(0, -1).join('.');
		const sanitizedLeaf = sanitizeGraphqlNameSegment(rawLeaf);

		leafByPath.set(rawPath, sanitizedLeaf);
		rawPathByFlatName.set(sanitizeGraphqlFlatName(rawPath), rawPath);
		if (!parentPath) {
			rawTopLevelByName.set(sanitizedLeaf, rawPath);
		}
		siblingsByParent.set(parentPath, [...(siblingsByParent.get(parentPath) ?? []), { rawPath, sanitizedLeaf }]);
	});

	const collisions: GraphqlNameCollision[] = [...siblingsByParent.entries()].flatMap(([parentPath, siblings]) => {
		const rawPathsByGraphqlName = new Map<string, string[]>();
		siblings.forEach(({ rawPath, sanitizedLeaf }) => {
			rawPathsByGraphqlName.set(sanitizedLeaf, [...(rawPathsByGraphqlName.get(sanitizedLeaf) ?? []), rawPath]);
		});

		return [...rawPathsByGraphqlName.entries()]
			.filter(([, rawPaths]) => rawPaths.length > 1)
			.map(([graphqlName, rawPaths]) => ({ graphqlName, parentPath, rawPaths }));
	});

	return {
		collisions,
		documentType: sanitizeGraphqlNameSegment(documentType),
		leafNamesByPath: Object.fromEntries(leafByPath),
		rawPathsByGraphqlFlatName: Object.fromEntries(rawPathByFlatName),
		rawTopLevelNamesByGraphqlName: Object.fromEntries(rawTopLevelByName),
		toGraphqlLeafName: (rawPath: string) =>
			leafByPath.get(rawPath) ?? sanitizeGraphqlNameSegment(rawPath.split('.').pop() ?? rawPath),
	};
};
