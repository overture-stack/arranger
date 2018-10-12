import mapHits from '../utils/mapHits';
import getIndexPrefix from '../utils/getIndexPrefix';

export default () => async (req, res) => {
  let { es } = req.context;
  let { id, index, field } = req.params;
  let { key, value } = req.body;

  if (!id || !index || !field) return res.json({ error: 'missing fields' });

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();
  const indexPrefix = getIndexPrefix({ projectId: id, index });
  try {
    await es.update({
      index: indexPrefix,
      type: indexPrefix,
      refresh: true,
      id: field,
      body: {
        doc: {
          [key]: value,
        },
      },
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

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
    return res.json({ error: error.message });
  }

  res.json({ fields: mapHits(fields), total: fields.hits.total });
};
