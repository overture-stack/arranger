import fetch from 'node-fetch';
import { PORT, PING_MS } from '../utils/config';

export default ({ socket }) => {
  socket.on('disconnect', () => {
    clearInterval(socket.monitorIntervalId);
  });

  socket.emit('server::init');

  socket.on('arranger::monitorProjects', ({ projects = [] }) => {
    let pingProject = async () => {
      let statuses = await Promise.all(
        projects.map(x =>
          fetch(`http://localhost:${PORT}/${x.id}/ping`)
            .then(r => r.ok && r.text())
            .then(r => ({ id: x.id, status: r === 'ok' ? 200 : 400 }))
            .catch(() => ({ id: x.id, status: 400 })),
        ),
      );

      socket.emit('server::projectsStatus', statuses);
    };

    pingProject();
    socket.monitorIntervalId = setInterval(pingProject, PING_MS);
  });
};
