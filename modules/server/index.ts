import { dirname } from 'path';
import { fileURLToPath } from 'url';

import 'dotenv/config';

import { App } from './src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
App(__dirname);
