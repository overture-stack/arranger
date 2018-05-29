export let fetchMapping = async ({ index, esType, es }) => {
  let aliases = await es.cat.aliases({ format: 'json' });
  let alias = aliases?.find(x => x.alias === index)?.index;

  return es.indices
    .getMapping({
      index: alias || index,
      type: esType,
    })
    .catch(err => {
      // TODO: return something more useful than false
      return false;
    })
    .then(val => ({ index: index, mapping: val, alias }));
};

export let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(({ index, name, esType }) =>
      fetchMapping({ index, esType: esType || index, es }),
    ),
  );
};
