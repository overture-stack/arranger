import streamData from './streamData';
import notifyOnUpdate from './notifyOnUpdate';

export default args => {
  streamData(args);
  notifyOnUpdate(args);
};
