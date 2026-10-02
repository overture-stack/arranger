import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

import { extendFields } from './extendMapping.js';
import type { FieldFromMapping } from './types.js';

/**
 * Combines a catalogue's `extended` configuration with its index mapping, separating the two
 * situations that previously shared one handler and one message.
 *
 * A catalogue configured without `extended.json` is supported and reports nothing. A failure to
 * extend the mapping is a fault, reports at error level, and names what degrades. Both still fall
 * back rather than stopping startup: what is lost is display configuration, not filtering, since
 * nested-field handling is read from the mapping.
 *
 * @param extendedConfigs - The catalogue's `extended` configuration, absent when it has none.
 * @param label - The catalogue's name, so an operator knows which one reported.
 * @param mappingFields - The index mapping flattened to fields, which owns each field's `type`.
 * @returns The extended fields, or an empty list where there is nothing to extend.
 */
export const resolveExtendedFields = ({
	extendedConfigs,
	label,
	mappingFields,
}: {
	extendedConfigs: ExtendedConfigs[] | undefined;
	label: string;
	mappingFields: FieldFromMapping[];
}): ExtendedConfigs[] => {
	if (!extendedConfigs) {
		return [];
	}

	try {
		return extendFields(mappingFields, extendedConfigs);
	} catch (error) {
		const message = error instanceof Error ? error.message : `${error}`;

		console.error(
			`Could not extend the index mapping for catalogue "${label}".\n` +
				`  Its facet, table and field display configuration falls back to the raw file contents and may be incomplete.\n` +
				`  This also reaches the GraphQL schema: \`isArray\` decides whether a field is published as [String] or String,\n` +
				`  so clients may see a different field type than they expect.\n` +
				`  Filtering is unaffected: nested-field handling is read from the mapping.\n` +
				`  Cause: ${message}`,
		);

		return Array.isArray(extendedConfigs) ? extendedConfigs : [];
	}
};
