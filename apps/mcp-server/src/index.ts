import 'dotenv/config';

import { startServer } from '#server.js';
import logger from '#utils/logger.js';

startServer().catch((err) => {
	logger.error({ err }, 'Failed to start MCP server');
	process.exit(1);
});
