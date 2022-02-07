import { ConfigProperties } from './types';
import getConfigFromFiles from './utils/getConfigFromFiles';

export * as CONFIG from './constants';
export { initializeSets } from './utils';

export default async (configsSource = '') => {
  // TODO: allow passing configs as an object, and not just a path
  try {
    console.log(' \nAttempting to create a configuration object:');
    const configs = await getConfigFromFiles(configsSource);

    Object.values(ConfigProperties).forEach((property) => {
      if (Object.keys(configs).includes(property) && configs[property]) {
        // in case we want to extend functionality/maniuplation for any specific property
        return; // safe noop
      }

      throw Error(`  The config files did not provide the required "${property}" property.`);
    });

    console.log('  Success!\n');
    return configs;
  } catch (error) {
    throw error || Error('Something went wrong while creating the configuration object.');
  }
};
