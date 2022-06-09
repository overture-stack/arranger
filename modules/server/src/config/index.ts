import { ConfigObject, ConfigRequiredProperties } from './types';
import getConfigFromFiles from './utils/getConfigFromFiles';

export * as ENV_CONFIG from './constants';
export { initializeSets } from './utils';

const validateProperties = (configs: ConfigObject) => {
  // Verify all the required values are present
  for (const property of Object.values(ConfigRequiredProperties)) {
    // this condition could be made more exhaustive if needed
    if (!(Object.keys(configs).includes(property) && configs[property])) {
      console.log('  Failed...');
      throw Error(`  The config files did not provide the required "${property}" property.`);
    }
  }

  // This would be where to filter out invalid properties.

  return configs;
};

// TODO: allow passing configs as an object, and not just a path
const getAndValidateConfigs = async (configsSource = '') => {
  console.log(' \nAttempting to create a configuration object:');

  try {
    const configs = await getConfigFromFiles(configsSource);
    const validConfigs = validateProperties(configs);

    console.log('  Success!\n');

    return validConfigs;
  } catch (error) {
    throw error || Error('Something went wrong while creating the configuration object.');
  }
};

export default getAndValidateConfigs;
