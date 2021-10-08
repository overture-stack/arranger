export let fetchMapping = async ({ esClient, index }) => {
  if (esClient) {
    console.log(`Fetching ES mapping for "${index}"...`);
    const aliases = (await esClient?.cat.aliases({ format: 'json' })).body;
    const alias = aliases?.find((foundIndex) => foundIndex.alias === index)?.index;
    alias && console.log(`Found it as an alias for index "${alias}".`);
    const accessor = alias || index;

    return esClient?.indices
      .getMapping({
        index: accessor,
      })
      .catch((error) => {
        console.error(error?.message || error);
        // TODO: analyse returning something more useful than false
        return false;
      })
      .then((response) => {
        const mappings = response?.body?.[accessor];

        if (mappings) {
          const mapping = mappings?.mappings?.properties;
          return { index: accessor, mappings, mapping, alias };
        }

        console.info(`Response could not be used to map "${accessor}":`, response?.body);
        throw new Error(`Could not create a mapping for "${accessor}"`);
      });
  }

  throw new Error('fetchMapping did not receive an esClient');
};
