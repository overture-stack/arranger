import 'dotenv/config';

import arrangerServer from './src/server.js';

const currentDirectory = process.env.INIT_CWD || process.env.npm_config_local_prefix || process.cwd();

arrangerServer({ currentDirectory });
