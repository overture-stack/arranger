export const serverConfigProperties = {
	ALLOWED_CORS_ORIGINS: 'allowedCorsOrigins',
	CONFIGS_PATH: 'catalogConfigsPath',
	PING_MS: 'pingMs',
	PING_PATH: 'pingPath',
	SERVER_PORT: 'serverPort',
} as const;

/**
 * Not part of the Arranger config, but used in search-server config files
 */
export const serverNetworkConfigExtendedProperties = {
	PASSTHROUGH_HEADERS: 'passthroughHeaders',
} as const;
