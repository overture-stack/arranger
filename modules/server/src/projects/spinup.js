import { graphqlExpress } from 'apollo-server-express';
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
} from '@arranger/mapping-utils';
import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';

export default ({ app }) => async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;
  if (!id) return res.json({ error: 'project empty' });

  let arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects`,
      type: `arranger-projects`,
      id,
      body: {
        doc: {
          active: true,
        },
      },
    },
  };

  try {
    await es.update(arrangerconfig.projectsIndex);
  } catch (error) {
    return res.json({ error: error.message });
  }

  arrangerconfig = {
    projectsIndex: {
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
    },
  };

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

  let typesWithMappings = addMappingsToTypes({
    types: hits.map(type => [
      type.index,
      {
        index: type.index,
        es_type: type.index,
        name: type.name,
        customFields: ``,
      },
    ]),
    mappings: mappings.map(m => m.mapping),
  });

  let schema = makeSchema({ types: typesWithMappings, rootTypes: [] });

  app.get(`/${id}/ping`, (req, res) => res.send('ok'));

  app.use(
    `/${id}/graphql`,
    schema
      ? graphqlExpress({ schema, context: { es } })
      : (req, res) =>
          res.json({
            error:
              'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
          }),
  );

  console.log(`graphql server running at ${id}/graphql`);

  res.json({ message: `graphql server running at ${id}/graphql` });
};
