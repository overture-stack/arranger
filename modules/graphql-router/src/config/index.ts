import { type ConfigsObject } from '@overture-stack/arranger-types/configs';
import { configRequiredProperties } from '@overture-stack/arranger-types/configs/constants';

export const validateConfigs = (configs: Partial<ConfigsObject>): Partial<ConfigsObject> => {
	console.log('  - Validating given configurations');
	// Verify all the required values are present
	for (const property of Object.values(configRequiredProperties)) {
		// this condition could be made more exhaustive if needed
		// TODO: tighten the config validations
		if (!(Object.keys(configs).includes(property) && configs[property])) {
			console.log('    Failed...');
			throw new Error(`    The configs did not include the required "${property}" property.`);
		}
	}

	// TODO: This would be where to filter out invalid properties.
	return configs;
};

export { default } from './constants.js';
export { initializeSets } from './utils/index.js';
