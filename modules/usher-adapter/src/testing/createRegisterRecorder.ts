import type { KeyRegistration } from '@overture-stack/usher-bridge--express';

import type { RegisterRecorder } from './types.js';

/**
 * Stands in for the one part of the Bridge the adapter calls, `register`, and records every
 * registration it is handed, since the real Bridge keeps no readable record of them.
 */
export const createRegisterRecorder = (): RegisterRecorder => {
	const registered: Readonly<Record<string, KeyRegistration>>[] = [];

	return {
		bridge: {
			register: (registrations) => {
				registered.push(structuredClone(registrations));
			},
		},
		registered,
	};
};
