import { graphqlExpress } from 'apollo-server-express';
import uuid from 'uuid/v4';
import { flattenDeep } from 'lodash';
import express from 'express';
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
  esToGraphqlTypeMap,
  mappingToColumnsState,
} from '@arranger/mapping-utils';
import { fetchMappings } from '../utils/fetchMappings';
import mapHits from '../utils/mapHits';

export default ({ app, io }) => async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  // indices must be lower cased
  id = id.toLowerCase();

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

  let extended = [];

  try {
    extended = await Promise.all(
      hits.map(async type => {
        let fields = await es.search({
          index: `arranger-projects-${id}-${type.index}`,
          type: `arranger-projects-${id}-${type.index}`,
          size: 0,
          _source: false,
        });

        fields = await es.search({
          index: `arranger-projects-${id}-${type.index}`,
          type: `arranger-projects-${id}-${type.index}`,
          size: fields.hits.total,
        });

        return { ...type, fields: mapHits(fields) };
      }),
    );
  } catch (error) {
    return res.json({ error: error.message });
  }

  let typesWithMappings = addMappingsToTypes({
    types: extended.map(type => {
      return [
        type.index,
        {
          index: type.index,
          es_type: type.index,
          name: type.name,
          extendedFields: type.fields,
          customFields: ``,
        },
      ];
    }),
    mappings: mappings.map(m => m.mapping),
  });

  let schema = makeSchema({ types: typesWithMappings, rootTypes: [] });

  const createAggsState = typesWithMappings.map(async ([type, props]) => {
    const index = `arranger-projects-${id}-${type}-aggs-state`;
    const count = await es
      .count({ index, type: index })
      .then(d => d.count, () => 0);
    return !(count > 0)
      ? [
          { index: { _index: index, _type: index, _id: uuid() } },
          JSON.stringify({
            timestamp: new Date().toISOString(),
            state: mappingToAggsState(props.mapping),
          }),
        ]
      : [];
  });

  const createColumnsState = typesWithMappings.map(async ([type, props]) => {
    const columns = mappingToColumnsState(props.mapping);
    const index = `arranger-projects-${id}-${type}-columns-state`;
    const count = await es
      .count({ index, type: index })
      .then(d => d.count, () => 0);

    return !(count > 0)
      ? [
          { index: { _index: index, _type: index, _id: uuid() } },
          JSON.stringify({
            timestamp: new Date().toISOString(),
            state: {
              type,
              keyField: 'id',
              defaultSorted: [
                { id: columns[0].id || columns[0].accessor, desc: false },
              ],
              columns,
            },
          }),
        ]
      : [];
  });

  let body = flattenDeep(
    await Promise.all([...createAggsState, ...createColumnsState]),
  );

  // TODO: don't add new ui states if decomissioned
  if (!global.apps[id] && body.length > 0) {
    await es.bulk({ body });
  }

  global.apps[id] = express.Router();

  global.apps[id].get(`/${id}/ping`, (req, res) => res.send('ok'));

  global.apps[id].use(
    `/${id}/graphql`,
    schema
      ? graphqlExpress({ schema, context: { es, projectId: id, io } })
      : (req, res) =>
          res.json({
            error:
              'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
          }),
  );

  io.emit('server::refresh');

  console.log(`graphql server running at /${id}/graphql`);

  res.json({ message: `graphql server running at /${id}/graphql` });
};
