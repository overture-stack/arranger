import { configRootProperties } from '@overture-stack/arranger-types/configs/constants';

import type { CataloguesMap } from '#configs/types/index.js';

export type FindCatalogueByIdentifierResult =
	| { catalogueId: string; outcome: 'matched' }
	| { outcome: 'not_found' }
	| { matchingCatalogueIds: string[]; outcome: 'ambiguous' };

/** Resolves a URL path segment to a catalogue, accepting either its real `catalogueId` or,
 * when it names exactly one catalogue, its `documentType`. A literal `catalogueId` match is
 * checked first and always wins, so a `documentType` value can never shadow a real catalogue
 * id. `documentType` has no uniqueness guarantee (see `docs/concepts.md`), so a value shared by
 * more than one catalogue is reported as `ambiguous` rather than resolving to an arbitrary one. */
const findCatalogueByIdentifier = ({
	catalogs,
	identifier,
}: {
	catalogs: CataloguesMap;
	identifier: string;
}): FindCatalogueByIdentifierResult => {
	if (identifier in catalogs) {
		return { catalogueId: identifier, outcome: 'matched' };
	}

	const matchingCatalogueIds = Object.entries(catalogs)
		.filter(([, catalogueConfigs]) => catalogueConfigs[configRootProperties.DOCUMENT_TYPE] === identifier)
		.map(([catalogueId]) => catalogueId);

	if (matchingCatalogueIds.length === 1) {
		return { catalogueId: matchingCatalogueIds[0] as string, outcome: 'matched' };
	}

	return matchingCatalogueIds.length === 0 ? { outcome: 'not_found' } : { matchingCatalogueIds, outcome: 'ambiguous' };
};

export default findCatalogueByIdentifier;
