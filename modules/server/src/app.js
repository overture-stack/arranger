import express from 'express';
import cors from 'cors';

import { ENV_CONFIG } from './config';
import Arranger from './server';

const app = express();
app.use(cors());

export default async function (rootPath = '') {
  global.__basedir = rootPath;

  return Arranger({ enableAdmin: ENV_CONFIG.ENABLE_ADMIN }).then((router) => {
    app.use(router);

    app.use(express.urlencoded({ extended: false, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));

    app.listen(ENV_CONFIG.PORT, async () => {
      const message = `⚡️⚡️⚡️ Listening on port ${ENV_CONFIG.PORT} ⚡️⚡️⚡️`;
      const line = '-'.repeat(message.length);

      console.info(`\n${line}`);
      console.log(message);
      console.info(`${line}\n`);
    });
  });
}
