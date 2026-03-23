import type { Client } from '@elastic/elasticsearch';
import { type ConfigsObject } from '@overture-stack/arranger-types/configs';
import {
	configArrangerBaseProperties,
	configRequiredProperties,
} from '@overture-stack/arranger-types/configs/constants';

export const validateConfigs = (configs: Partial<ConfigsObject>, esClient?: Client): Partial<ConfigsObject> => {
	console.log('  - Validating catalog configurations provided');
	const propertiesToDemand = esClient ? configArrangerBaseProperties : configRequiredProperties;

	// Verify all the required values are present
	for (const property of Object.values(propertiesToDemand)) {
		// this condition could be made more exhaustive if needed
		// TODO: tighten the config validations using Zod
		if (!(Object.keys(configs).includes(property) && configs[property])) {
			console.log('  Failed...');
			throw new Error(`The configs did not include the required "${property}" property.`);
		}
	}

	// TODO: This would be where to filter out invalid properties. give warnings
	return configs;
};

export { default } from './constants.js';
export { initializeSets } from './utils/index.js';
