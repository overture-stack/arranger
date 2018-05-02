import { flattenDeep } from 'lodash';
import { extendFields, extendMapping } from '@arranger/mapping-utils';
import mapHits from '../utils/mapHits';
import getIndexPrefix from '../utils/getIndexPrefix';

export default async (req, res) => {
  let { es } = req.context;
  let { id, index } = req.params;

  if (!id || !index) {
    return res.json({ error: 'missing fields' });
  }

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();
  const indexPrefix = getIndexPrefix({ projectId: id, index });
  let arrangerConfig = {
    projectsIndex: {
      index: indexPrefix,
      type: indexPrefix,
    },
  };

  let fields = [];

  try {
    fields = await es.search({
      index: indexPrefix,
      type: indexPrefix,
      size: 0,
      _source: false,
    });

    fields = await es.search({
      index: indexPrefix,
      type: indexPrefix,
      size: fields.hits.total,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerConfig.projectsIndex.index,
      });

      let aliases = await es.cat.aliases({ format: 'json' });
      let alias = aliases?.find(x => x.alias === index)?.index;

      let mappings = await es.indices.getMapping({
        index: alias || index,
        type: index,
      });

      let mapping = mappings[alias || index].mappings[index].properties;

      let fields = extendMapping(mapping);

      let body = flattenDeep(
        fields.map(x => [
          {
            index: {
              _index: arrangerConfig.projectsIndex.index,
              _type: arrangerConfig.projectsIndex.index,
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
  }

  res.json({
    fields: extendFields({ fields: mapHits(fields), includeOriginal: true }),
    total: fields.hits.total,
  });
};
