import express from 'express';
import cors from 'cors';

import { CONFIG } from './config';
import Arranger from './server';

const app = express();
app.use(cors());

export default async function (rootPath = '') {
  global.__basedir = rootPath;

  // Always run test server as admin
  return Arranger({ enableAdmin: false }).then((router) => {
    app.use(router);

    app.use(express.urlencoded({ extended: false, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));

    app.listen(CONFIG.PORT, async () => {
      const message = `⚡️⚡️⚡️ Listening on port ${CONFIG.PORT} ⚡️⚡️⚡️`;
      const line = '-'.repeat(message.length);

      console.info(`\n${line}`);
      console.log(message);
      console.info(`${line}\n`);
    });
  });
}
