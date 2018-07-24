import express from 'express';
import bodyParser from 'body-parser';

const workers = [];
const clients = [];
const downloadSockets = {};

const disconnect = ({ socket, collection }) => reason => {
  console.log('disconnect: ', reason);
  workers.splice(workers.indexOf(socket), 1);
};

const clientLog = data => console.log('[client]| ', data);
const workerLog = data => console.log('[worker]| ', data);

const setUpWorker = worker => {
  workers.push(worker);
  workerLog(workers.length);
  worker.on('server::refresh', data => {
    workerLog('got the refresh!!!', data);
  });
  worker.on('server::download::complete', ({ downloadKey }) => {
    if (downloadSockets[downloadKey]) {
      downloadSockets[downloadKey].emit(`server::download::${downloadKey}`);
    }
    delete downloadSockets[downloadKey];
  });
  worker.on('server::projectsStatus', statuses => {
    workerLog('server::projectsStatus');
    clients.forEach(client => client.emit('server::projectsStatus', statuses));
  });
  worker.on('server::init', () => {
    workerLog('server::init');
    clients.forEach(client => client.emit('server::init'));
  });
  worker.on('disconnect', disconnect({ socket: worker, collection: workers }));
};

const setUpClient = client => {
  clients.push(client);
  client.on(`client::download::request`, ({ downloadKey }) => {
    downloadSockets[downloadKey] = clients;
  });
  client.on('arranger::monitorProjects', data => {
    clientLog('arranger::monitorProjects');
    clientLog('workers.length: ', workers);
    workers.forEach(worker => worker.emit('arranger::monitorProjects', data));
  });
  client.on('disconnect', disconnect({ socket: clients, collection: clients }));
};

export default async ({ io, graphqlOptions = {} } = {}) => {
  const router = express.Router();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use(bodyParser.json({ limit: '50mb' }));

  io
    .use((socket, next) => {
      const { type } = socket.handshake.query;
      socket.type = type;
      console.log('socket.type: ', socket.type);
      console.log('connected!');
      next();
    })
    .on('connection', socket => {
      if (socket.type === 'ARRANGER_WORKER') {
        setUpWorker(socket);
      } else if (socket.type === 'ARRANGER_UI') {
        setUpClient(socket);
      }
    });

  return router;
};
