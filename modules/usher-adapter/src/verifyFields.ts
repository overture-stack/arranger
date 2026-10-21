import type { KeyRegistration } from '@overture-stack/usher-express-bridge';

import { conditionProblemsOf } from './conditionFields.js';

/**
 * Every reason access cannot be enforced on a catalogue as registered, against its index mapping as the
 * GraphQL router fetched it. An open catalogue names no field, an artifact key is refused, and a record
 * key's resource field and category conditions are checked as `conditionProblemsOf` holds. Each reason
 * names the catalogue, and the category and field at fault, all of them the operator's configuration.
 *
 * @param catalogueId the catalogue's key.
 * @param registration what the catalogue registers with the bridge, already held to Usher's registration format.
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
			return conditionProblemsOf(catalogueId, registration, mapping);
	}
};
