import express from 'express';
import bodyParser from 'body-parser';

const workers = [];
const downloadSockets = {};

export default async ({ io, graphqlOptions = {} } = {}) => {
  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json({ limit: '50mb' }));

  io
    .use((socket, next) => {
      const { type } = socket.handshake.query;
      socket.type = type;
      console.log('connected!');
      next();
    })
    .on('connection', socket => {
      if (socket.type === 'ARRANGER_WORKER') {
        workers.push(socket);
        console.log('workers.length: ', workers.length);
        socket.on('server::refresh', data => {
          console.log('got the refresh!!!', data);
        });
        socket.on('server::download::complete', ({ downloadKey }) => {
          if (downloadSockets[downloadKey]) {
            downloadSockets[downloadKey].emit(
              `server::download::${downloadKey}`,
            );
          }
          delete downloadSockets[downloadKey];
        });
        socket.on('disconnect', reason => {
          console.log('disconnect: ', reason);
          workers.splice(workers.indexOf(socket), 1);
        });
      } else if (socket.type === 'ARRANGER_UI') {
        socket.on(`client::download::request`, ({ downloadKey }) => {
          downloadSockets[downloadKey] = socket;
        });
        socket.on('disconnect', reason => {
          console.log('disconnect: ', reason);
          workers.splice(workers.indexOf(socket), 1);
        });
      }
    });

  return router;
};
