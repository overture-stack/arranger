export let fetchMapping = async ({ index, es }) => {
  // TODO: check for aliases!!

  let aliases = await es.cat.aliases({ format: 'json' });

  console.log(123, aliases);

  return es.indices
    .getMapping({
      index,
      type: index,
    })
    .catch(err => {
      // TODO: return something more useful than false
      return false;
    })
    .then(val => {
      return { index: index, mapping: val };
    });
};

export let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(({ index }) => {
      return fetchMapping({ index, es });
    }),
  );
};
