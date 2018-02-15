import { promisify } from 'util';
import { exec as e } from 'child_process';

let exec = promisify(e);

let github = {};
let newerGithub = {};

let restartCmd =
  'cd ~/arranger && git pull && npm i && npm run bootstrap -- --scope @arranger/server --include-filtered-dependencies && pm2 restart api';

let restart = ({ io }) => {
  io.emit('server::serverRestarting');

  exec(restartCmd, err => {
    if (err) throw err;
  });
};

let getGitInfo = async ({ cmd, key }) => {
  try {
    let output = await exec(cmd);
    github[key] = output.stdout.trim();
  } catch (error) {
    console.log(error);
  }
};

export default async ({ app, io }) => {
  await getGitInfo({
    cmd: 'git rev-parse --abbrev-ref HEAD',
    key: 'branch',
  });

  await getGitInfo({
    cmd: 'git rev-parse HEAD',
    key: 'commit',
  });

  app.post('/restartServer', (req, res) => {
    restart({ io });
  });

  app.post('/github', (req, res) => {
    newerGithub.branch = req.body.ref
      .split('/')
      .pop()
      .trim();

    newerGithub.commit = req.body.after.trim();

    if (
      newerGithub.branch === github.branch &&
      newerGithub.commit !== github.commit
    ) {
      io.emit('server::newServerVersion');
      return res.json({ message: 'new arranger available' });
    }

    res.json({ message: 'github push occured' });
  });
};
