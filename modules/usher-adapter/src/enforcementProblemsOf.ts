import type { KeyRegistration } from '@overture-stack/usher-bridge--express';

import { conditionProblemsOf } from './conditionProblemsOf.js';

/**
 * Every reason access cannot be enforced on a catalogue as registered, against its index mapping. An open
 * catalogue names no field; a record catalogue's resource field and category conditions are checked by
 * `conditionProblemsOf`, and Usher's registration format refuses any other kind. Each reason names the
 * catalogue, and the category and field at fault, all of them configuration rather than data.
 *
 * @param catalogueId the catalogue's key.
 * @param registration what the catalogue registers with the Bridge, already held to Usher's registration format.
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
		case 'record':
			return conditionProblemsOf(catalogueId, registration, mapping);
	}
};
