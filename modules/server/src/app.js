import express from 'express';
import { Server } from 'http';
import cors from 'cors';
import adminGraphql from '@arranger/admin/dist';
import { ES_HOST, ES_PASS, ES_USER } from './utils/config';

import { PORT } from './utils/config';
import Arranger from './server';

const app = express();
app.use(cors());

const http = Server(app);

export default async function () {
  // the admin app
  const adminPath = '/admin/graphql';
  const adminApp = await adminGraphql({ esHost: ES_HOST, esUser: ES_USER, esPass: ES_PASS });
  adminApp.applyMiddleware({ app, path: adminPath });
  console.log(`🚀 Admin API available at: [arranger_root]${adminPath}`);

  // Always run test server as admin
  return Arranger({ enableAdmin: false }).then((router) => {
    app.use(router);
    http.listen(PORT, async () => {
      console.log(`⚡️⚡️⚡️ Listening on port ${PORT} ⚡️⚡️⚡️`);
    });
  });
}
