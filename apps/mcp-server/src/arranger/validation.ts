import { type ArrangerClient } from '#arranger/client.js';
import { type ArrangerMcpConfig } from '#utils/config.js';
import logger from '#utils/logger.js';

/**
 * Validates the connection to Arranger by checking the /introspection and /introspection/sqon endpoints,
 * and ensuring that all configured catalogues are available.
 * @param config - The MCP server configuration containing Arranger connection details and catalogues to validate.
 * @param client - An instance of ArrangerClient used to make requests to Arranger.
 * @throws Will throw an error if the connection to Arranger fails or if any configured catalogue is not available.
 */
export const validateArrangerConnection = async (config: ArrangerMcpConfig, client: ArrangerClient): Promise<void> => {
	try {
		const { catalogs: catalogues } = await client.getServerIntrospection();
		await client.getSqonIntrospection();
		logger.info('Connected to Arranger /introspection and /introspection/sqon.');

		const available = new Set(Object.keys(catalogues));
		const missing = config.catalogues.filter((catalogue) => !available.has(catalogue));
		if (missing.length > 0) {
			throw new Error(`Configured catalogues not available on Arranger: ${missing.join(', ')}`);
		}

		for (const catalogueId of config.catalogues) {
			await client.getCatalogueIntrospection(catalogueId);
		}
		logger.info({ catalogues: config.catalogues }, 'All configured catalogues validated.');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Arranger connection validation failed: ${message}`);
	}
};
