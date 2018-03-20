import express from 'express';
import socketIO from 'socket.io';
import { Server } from 'http';
import { PORT } from './utils/config';
import { rainbow } from 'chalk-animation';
import Arranger from './';

const app = express();
const http = Server(app);
const io = socketIO(http);

Arranger({ io }).then(router => {
  app.use(router);
  http.listen(PORT, async () => {
    rainbow(`⚡️ Listening on port ${PORT} ⚡️`);
  });
});
