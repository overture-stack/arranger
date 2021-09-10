export let fetchMapping = async ({ index, es }) => {
  let aliases = (await es.cat.aliases({ format: 'json' })).body;
  let alias = aliases?.find((x) => x.alias === index)?.index;

  return es.indices
    .getMapping({
      index: alias || index,
    })
    .catch((err) => {
      // TODO: return something more useful than false
      return false;
    })
    .then((response) => {
      const mapping = response.body;
      return { index, mapping, alias };
    });
};
