import { type ConfigsObject } from '@overture-stack/arranger-types/configs';
import { configArrangerBaseProperties, configRequiredProperties } from '@overture-stack/arranger-types/configs';

import { type SearchClient } from '#searchClient/index.js';
import type { ArrangerBaseContext } from '#types.js';

export const validateConfigs = <Context extends ArrangerBaseContext>(
	configs: Partial<ConfigsObject<Context>>,
	esClient?: SearchClient,
): Partial<ConfigsObject<Context>> => {
	console.log('  - Validating catalogue configurations provided');

	// Require base properties, and also ES connection properties if the esClient is not available
	const propertiesToDemand = esClient ? configArrangerBaseProperties : configRequiredProperties;

	// TODO: tighten the config validations using Zod
	const missingProperties = Object.values(propertiesToDemand).filter(
		(property) => !(Object.keys(configs).includes(property) && configs[property]),
	);

	if (missingProperties.length > 0) {
		console.log('  Failed...');
		throw new Error(
			`The configs were missing required properties: ${missingProperties.map((property) => `"${property}"`).join(', ')}`,
		);
	}

	// TODO: This would be where to filter out invalid properties. give warnings
	return configs;
};

export { default } from './constants.js';
export { initializeSets } from './utils/index.js';
