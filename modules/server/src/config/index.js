import * as CONFIG from './constants';
import { ConfigProperties } from './types';
import getConfigFromFiles from './utils/getConfigFromFiles';

export { initializeSets } from './utils';
export { CONFIG };

export default async () => {
  try {
    console.log('Attempting to create a configuration object:');
    const configs = await getConfigFromFiles(CONFIG.CONFIG_FILES_PATH);

    Object.values(ConfigProperties).forEach((property) => {
      if (Object.keys(configs).includes(property) && configs[property]) {
        // in case we want to extend functionality/maniuplation for any specific property
        return; // safe noop
      }

      throw Error(`The config files did not provide the required "${property}" property.`);
    });

    console.log('Success!\n');
    return configs;
  } catch (error) {
    throw error || Error('Something went wrong while creating the configuration object.');
  }
};
