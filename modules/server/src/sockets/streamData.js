import socketStream from 'socket.io-stream';
import getAllData from '../utils/getAllData';
import through2 from 'through2';

export default ({ socket, schema, context }) =>
  socketStream(socket).on('client::stream', (stream, args) => {
    getAllData(args)
      .pipe(
        through2.obj(function(chunk, enc, callback) {
          this.push(JSON.stringify(chunk));
          callback();
        }),
      )
      .pipe(stream);
  });
