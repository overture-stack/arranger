import streamData from './streamData';
import notifyOnUpdate from './notifyOnUpdate';

export default ({ io, ...args }) => {
  io.on('connection', socket => {
    streamData({ ...args, socket });
    notifyOnUpdate({ ...args, socket });
  });
};
