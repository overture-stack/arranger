import type { ArrangerBaseContext } from '@overture-stack/arranger-graphql-router';
import {
	configArrangerNetworkProperties,
	type CustomizeRemoteRequestFn,
	type CustomRemoteRequestProps,
	type NetworkConfig,
	type SortingConfigs,
} from '@overture-stack/arranger-types/configs';
import { configRootProperties, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import { merge } from 'lodash-es';

import {
	serverNetworkConfigExtendedProperties,
	serverNetworkRemoteRequestCustomizationConfigProperties,
} from '#configs/types/constants.js';
import type { ExternalNetworkConfig } from '#configs/types/index.js';

/**
 * This will assume the network config provided has the expected format, it is not fully validated.
 * TODO: Fully validate config file structure
 */
const getNetworkConfig = (fileDataJSON: any): ExternalNetworkConfig | undefined => {
	return fileDataJSON[configRootProperties.NETWORK_AGGREGATION] as NetworkConfig<ArrangerBaseContext>;
};

/**
 * Convert External File Network Config into the Arranger NetworkConfig format expected.
 *
 * Side Effects: will modify the configFilesJson object provided
 *
 *
 * - Create customRemoteRequestFn based on the optional `passthroughHeaders` value and add to configFilesJson
 */
const normalizeNetworkConfig = (configFilesJson: any) => {
	// Create network search CustomRemoteRequestFn from config properties
	// - network.passthroughHeaders will take incoming request headers and add them to the outgoing remote node requests
	const networkConfig = getNetworkConfig(configFilesJson);
	if (networkConfig) {
		const remoteNodeExtendedConfigs = networkConfig[configArrangerNetworkProperties.REMOTE_NODES];

		// only need to provide custom request fn if we have any remote nodes configured
		if (remoteNodeExtendedConfigs && remoteNodeExtendedConfigs.length) {
			const allRequestsPassthroughHeaders =
				networkConfig[serverNetworkConfigExtendedProperties.REMOTE_REQUESTS]?.[
					serverNetworkRemoteRequestCustomizationConfigProperties.HEADERS
				] ?? [];

			// Create the custom request function
			const customRemoteRequestFn: CustomizeRemoteRequestFn<ArrangerBaseContext> = (params) => {
				const headers: CustomRemoteRequestProps['headers'] = {};

				// No remote node ID, so let's find the exact match in teh config (matching name and graphqlUrl).
				// If there are multiple matches, we can't differentiate, we will use the first match from the configs
				const matchingConfig = remoteNodeExtendedConfigs.find(
					(node) =>
						node.graphqlUrl === params.remoteNode.graphqlUrl &&
						node.displayName === params.remoteNode.displayName,
				);

				// use the request.headers value from matching config if present, otherwise use the allRequestsPassthroughHeaders
				const passthroughHeaders = matchingConfig?.requests?.headers ?? allRequestsPassthroughHeaders;

				passthroughHeaders.forEach((headerName) => {
					const headerValue = params.context?.request?.headers?.get(headerName);
					if (headerValue) {
						headers[headerName] = headerValue;
					}
				});

				return {
					headers,
				};
			};
			// Add the custom request function to the network config
			networkConfig.customizeRemoteRequest = customRemoteRequestFn;
		}
	}
};

/**
 * Format Table Config for Arranger ConfigObject.
 *
 * Side Effects: Will modify the fileDataJSON object provided.
 *
 * - Ensures every entry in `table.defaultSorting` has `desc` explicitly set,
 *   defaulting to `false` when the field is absent.
 */
const normalizeTableConfig = (fileDataJSON: any) => {
	// Format table config
	// table.defaultSorting needs `desc` explicitly set and default to `false` when no value is provided
	if (fileDataJSON?.[configRootProperties.TABLE]?.[tableProperties.DEFAULT_SORTING]) {
		return merge(fileDataJSON, {
			[configRootProperties.TABLE]: {
				...fileDataJSON[configRootProperties.TABLE],
				[tableProperties.DEFAULT_SORTING]: fileDataJSON[configRootProperties.TABLE][
					tableProperties.DEFAULT_SORTING
				].map((sorting: SortingConfigs) => ({
					...sorting,
					desc: sorting.desc || false,
				})),
			},
		});
	}
};

/**
 * Normalizes raw config file JSON for use by the search server. Takes the raw JSON read from any provided config files
 * and formats them as a valid arranger ConfigObject
 *
 * - Normalize Network Config:
 *   - Create customRemoteRequestFn based on `passthroughHeaders` value
 * - Normalize Table Config:
 *   - Ensures every entry in `table.defaultSorting` has `desc` explicitly set,
 *     defaulting to `false` when the field is absent.
 */
const normalize = (fileDataJSON: any) => {
	// TODO: this mutational logic is brittle
	normalizeTableConfig(fileDataJSON);
	normalizeNetworkConfig(fileDataJSON);

	return fileDataJSON;
};

export default normalize;
