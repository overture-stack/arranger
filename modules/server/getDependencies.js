var packageJSON = require('./package.json');
var dependencyKeys = ['dependencies', 'peerDependencies', 'devDependencies'];
console.log(
  dependencyKeys
    .reduce(
      function (dependencies, key) {
        return dependencies.concat(
          Object.keys(packageJSON[key] || {})
            .filter((n) => n.indexOf('@arranger') >= 0)
            .map((n) => n.split('/')[1]),
        );
      },
      ['', 'server'],
    )
    .join(' --watch '),
);
