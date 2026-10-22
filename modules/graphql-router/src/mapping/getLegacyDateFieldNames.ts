import { ES_DATE_FORMAT } from '#middleware/constants.js';

/** One level of an index mapping's `properties`, as far as this module reads it. */
type MappingProperties = Record<string, { format?: string; properties?: MappingProperties; type?: string }>;

const DATE_TYPES = ['date', 'date_nanos'];

/** Whether a mapping `format` holds `ES_DATE_FORMAT` as one of its `||` alternatives, as the engine splits them. */
const holdsLegacyDatePattern = (format?: string): boolean =>
	format?.split('||').some((pattern) => pattern === ES_DATE_FORMAT) ?? false;

/**
 * The full path of every date field whose mapping `format` holds the legacy pattern, `ES_DATE_FORMAT`,
 * among its alternatives, under objects and nested fields alike. A filter's date alone on one of these
 * is rewritten to cover its whole day, since such a format may not read a date alone at all.
 *
 * @param properties an index mapping's `properties`, as `fetchMapping` returns them.
 * @param parent the path of the object holding `properties`, for the recursion.
 */
const getLegacyDateFieldNames = (properties?: MappingProperties, parent = ''): string[] =>
	Object.entries(properties ?? {}).flatMap(([fieldName, { format, properties: children, type }]) => {
		const fullPath = parent ? `${parent}.${fieldName}` : fieldName;
		const isLegacyDateField = DATE_TYPES.includes(type ?? '') && holdsLegacyDatePattern(format);

		return [...(isLegacyDateField ? [fullPath] : []), ...getLegacyDateFieldNames(children, fullPath)];
	});

export default getLegacyDateFieldNames;
