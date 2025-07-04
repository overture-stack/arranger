import { type ConfigObject, configRequiredProperties } from './types.js';
import getConfigFromFiles from './utils/getConfigFromFiles.js';
import { makeConfigsFromEnv } from './utils/index.js';

export * as ENV_CONFIG from './constants.js';
export { initializeSets } from './utils/index.js';

const validateProperties = (configs: Partial<ConfigObject>) => {
	// Verify all the required values are present
	for (const property of Object.values(configRequiredProperties)) {
		// this condition could be made more exhaustive if needed
		if (!(Object.keys(configs).includes(property) && configs[property])) {
			console.log('  Failed...');
			throw Error(`  The configs did not include the required "${property}" property.`);
		}
	}

	// TODO: This would be where to filter out invalid properties.

	console.log('  Success!\n');
	return configs;
};

// TODO: allow passing configs as an object, and not just a path
const getAndValidateConfigs = async (configsSource = '') => {
	console.log(' \nAttempting to create a configuration object:');

	const configsFromEnv = makeConfigsFromEnv();

	try {
		const configs = await getConfigFromFiles(configsSource, configsFromEnv);

		return validateProperties(configs);
	} catch (error) {
		console.log('  - Defaulting to config values from the environment...');
		// TODO: add DEBUG error for files not loading correctly

		return (
			validateProperties(configsFromEnv) ||
			// this is unreachable right now, but it's left here to cover edge cases from future implementation
			console.error(error || Error('Something went wrong while creating the configuration object.'))
		);
	}
};

export default getAndValidateConfigs;
