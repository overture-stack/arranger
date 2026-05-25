/**
 * Object with all properties required to define the types for an index used by an arranger schema.
 */
export type SchemaTypesDefinition = Record<string, any>;
// TODO: More precise SchemaTypesDefinition type

/**
 * Tuple used to store a search engine's index types definition.
 *
 * `SchemaTypesTuple[0]` stores the ID for the type, for example `'donor'`, `'file'`, or
 * the reserved name `'sets'`.
 *
 * `SchemaTypesTuple[1]` contains the types defintions that will be used to define this schema.
 */
export type SchemaTypesTuple = [string, SchemaTypesDefinition];
