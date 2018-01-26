export let fetchMapping = async ({ index, es }) => {
  let aliases = await es.cat.aliases({ format: 'json' });
  let alias = aliases?.find(x => x.alias === index)?.index;

  return es.indices
    .getMapping({
      index: alias || index,
      type: index,
    })
    .catch(err => {
      // TODO: return something more useful than false
      return false;
    })
    .then(val => {
      return { index: index, mapping: val, alias };
    });
};

export let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(({ index }) => {
      return fetchMapping({ index, es });
    }),
  );
};
