import { promisify } from 'util';
import { exec as e } from 'child_process';
import chalk from 'chalk';

let exec = promisify(e);

let github = {};
let newerGithub = {};

let restartCmd =
  'RESTART=true cd ~/arranger && git pull && npm i && npm run bootstrap -- --scope @arranger/server --include-filtered-dependencies && pm2 restart api';

let restart = ({ io }) => {
  console.log(chalk`♻️ {server rebuild initializing} ♻️`);
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

  console.log(234, process.env);

  if (process.env.RESTART) {
    io.emit('server::restartSuccesful');
  }

  app.post('/restartServer', (req, res) => {
    restart({ io });
    res.json({ message: 'restarting server' });
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
