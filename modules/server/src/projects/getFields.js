import { flattenDeep } from 'lodash';
import { mappingToAggsState } from '@arranger/mapping-utils';
import mapHits from '../utils/mapHits';

export default async (req, res) => {
  let { es } = req.context;
  let { id, index } = req.params;

  if (!id || !index) {
    return res.json({ error: 'missing fields' });
  }

  let arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects-${id}-${index}`,
      type: `arranger-projects-${id}-${index}`,
    },
  };

  let fields = [];

  try {
    fields = await es.search(arrangerconfig.projectsIndex);
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerconfig.projectsIndex.index,
      });

      // TODO: check for aliases!!
      let mappings = await es.indices.getMapping({
        index,
        type: index,
      });

      let mapping = mappings[index].mappings[index].properties;

      let fields = mappingToAggsState(mapping);

      let body = flattenDeep(
        fields.map(x => [
          {
            index: {
              _index: arrangerconfig.projectsIndex.index,
              _type: arrangerconfig.projectsIndex.index,
              _id: x.field,
            },
          },
          JSON.stringify(x),
        ]),
      );

      await es.bulk({ body });
      return res.json({ fields, total: fields.length });
    } catch (error) {
      return res.json({ error: error.message });
    }
    return res.json({ error: error.message });
  }

  res.json({ fields: mapHits(fields), total: fields.hits.total });
};
