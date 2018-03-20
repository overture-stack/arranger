import express from 'express';
import socketIO from 'socket.io';
import { Server } from 'http';
import { rainbow } from 'chalk-animation';

import { PORT } from './utils/config';
import Arranger from './server';

const app = express();
const http = Server(app);
const io = socketIO(http);

export default function() {
  return Arranger({ io }).then(router => {
    app.use(router);
    http.listen(PORT, async () => {
      rainbow(`⚡️ Listening on port ${PORT} ⚡️`);
    });
  });
}
