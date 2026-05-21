import type { ArrangerBaseContext } from '@overture-stack/arranger-graphql-router';
import {
	type CustomizeRemoteRequestFn,
	type CustomRemoteRequestProps,
	type NetworkConfig,
	type SortingConfigs,
} from '@overture-stack/arranger-types/configs';
import { configRootProperties, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import { merge } from 'lodash-es';

import { serverNetworkConfigExtendedProperties } from '#configs/types/constants.js';
import type { ExternalNetworkConfig } from '#configs/types/index.js';

/**
 * This will assume the network config provided has the expected format, it is not fully validated.
 * TODO: Fully validate config file structure
 */
const getNetworkConfig = (fileDataJSON: any): ExternalNetworkConfig | undefined => {
	return fileDataJSON[configRootProperties.NETWORK_AGGREGATION] as NetworkConfig<ArrangerBaseContext>;
};

const getNetworkPassthroughHeaders = (networkConfig: ExternalNetworkConfig): string[] => {
	const passthroughHeaders = networkConfig[serverNetworkConfigExtendedProperties.PASSTHROUGH_HEADERS] ?? [];

	// If passthroughHeaders value is provided, check that the passthroughHeaders value is an array of strings.
	// We want to error out if the provided file config is not a usable format.
	if (
		!(Array.isArray(passthroughHeaders) && passthroughHeaders.every((value) => typeof value === 'string'))
	) {
		throw new Error(
			`Provided Network Config value for 'passthroughHeaders' is not a valid array of strings. This will cause issues during network resolution. Please correct the network config.`,
		);
	}

	return passthroughHeaders;
};

/**
 * Convert External File Network Config into the Arranger NetworkConfig format expected.
 *
 * Side Effects: will modify the fileDataJSON object provided
 *
 * - Create customRemoteRequestFn based on the optional `passthroughHeaders` value
 */
const normalizeNetworkConfig = (fileDataJSON: any) => {
	// Create network search CustomRemoteRequestFn from config properties
	// - network.passthroughHeaders will take incoming request headers and add them to the outgoing remote node requests
	const networkConfig = getNetworkConfig(fileDataJSON);
	if (networkConfig) {
		const passthroughHeaders = getNetworkPassthroughHeaders(networkConfig);
		if (passthroughHeaders.length) {
			// Only need to create and add this function if any passthrough headers were provided.

			const customRemoteRequestFn: CustomizeRemoteRequestFn<ArrangerBaseContext> = (params) => {
				const headers: CustomRemoteRequestProps['headers'] = {};

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
