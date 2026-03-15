import { dirname } from 'path';
import { fileURLToPath } from 'url';

import 'dotenv/config';

import arrangerServer from './src/server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
arrangerServer(__dirname);
