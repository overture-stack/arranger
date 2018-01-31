import { flattenDeep } from 'lodash';
import { extendFields } from '@arranger/mapping-utils';
import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;
  let { index, name } = req.body;

  if (!id || !index || !name) {
    return res.json({ error: 'missing fields' });
  }

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();

  let arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
    },
  };

  try {
    await es.create({
      ...arrangerconfig.projectsIndex,
      refresh: true,
      id: index,
      body: {
        index,
        name,
        active: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  let types = [];

  try {
    types = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });
      return res.json({ types });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  let hits = mapHits(types);

  let mappings = await fetchMappings({ es, types: hits });

  if (hits.some(x => mappings.find(y => y.index === x.index).mapping)) {
    try {
      await es.indices.create({
        index: `arranger-projects-${id}-${index}`,
      });

      let aliases = await es.cat.aliases({ format: 'json' });
      let alias = aliases?.find(x => x.alias === index)?.index;

      let mappings = await es.indices.getMapping({
        index: alias || index,
        type: index,
      });

      let mapping = mappings[alias || index].mappings[index].properties;

      let fields = extendFields(mapping);

      let body = flattenDeep(
        fields.map(x => [
          {
            index: {
              _index: `arranger-projects-${id}-${index}`,
              _type: `arranger-projects-${id}-${index}`,
              _id: x.field,
            },
          },
          JSON.stringify(x),
        ]),
      );

      await es.bulk({ body });
    } catch (error) {
      return res.json({ error: error.message });
    }
  }

  res.json({
    types: hits.map(x => ({
      ...x,
      mappings: mappings.find(y => y.index === x.index).mapping,
    })),
    total: types.hits.total,
  });
};
