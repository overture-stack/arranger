import streamData from './streamData';
import notifyOnUpdate from './notifyOnUpdate';

export const broadcastServerRefresh = ({ io, ioSocket }) => {
  io.emit('server::refresh');
  ioSocket.emit('server::refresh', {
    someData: "here's some data",
  });
};

export const broadcastDownloadComplete = ({ io, downloadKey }) =>
  io.emit(`server::download::complete`, {
    downloadKey,
  });

export default ({ io, ...args }) => {
  io.on('connection', socket => {
    streamData({ ...args, socket });
    notifyOnUpdate({ ...args, socket });
  });
};
