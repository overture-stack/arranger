import type { ExtendedConfigs } from '@overture-stack/arranger-types/configs';

import { extendFields, flattenMappingToFields } from './extendMapping.js';

/**
 * Merges a live ES index mapping with extended config to produce the authoritative
 * field list for a catalogue. Pure transformation — no network calls, no framework
 * dependencies.
 *
 * Future home: `arranger-core`. Today lives in `graphql-router/mapping/` as a
 * stepping stone toward decoupling core logic from the transport layer.
 *
 * Any transport adapter (REST, gRPC, GraphQL) can call this with a pre-fetched
 * mapping and its extended config to obtain the canonical field list.
 */
const resolveCatalogueFields = (
	mapping: Record<string, unknown>,
	extendedConfigs: ExtendedConfigs[],
): ExtendedConfigs[] => extendFields(flattenMappingToFields(mapping), extendedConfigs);

export default resolveCatalogueFields;
