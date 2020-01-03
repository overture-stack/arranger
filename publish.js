const { exec } = require('child_process');
const promisify = require('util').promisify;

(async () => {
  const run = (...args) =>
    promisify(exec)(...args).then(({ stdout, stderr }) => {
      if (stderr) {
        console.error(stderr);
        process.exit(1);
      } else {
        console.log(stdout);
        return stdout;
      }
    });
  const { version } = require('./lerna.json');

  await run(`npm run lerna publish -- --yes --dist-tag ${version}`);
})();
