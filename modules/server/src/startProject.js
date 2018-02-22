import { graphqlExpress } from 'apollo-server-express';
import uuid from 'uuid/v4';
import { flattenDeep } from 'lodash';
import express from 'express';
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
  mappingToColumnsState,
} from '@arranger/mapping-utils';
import { fetchMappings } from './utils/fetchMappings';
import mapHits from './utils/mapHits';
import { getProject, setProject } from './utils/projects';
import download from './download';

function setProjectActive({ id, es }) {
  return es.update({
    index: `arranger-projects`,
    type: `arranger-projects`,
    id,
    body: { doc: { active: true } },
  });
}

async function getTypes({ id, es }) {
  const index = `arranger-projects-${id}`;

  try {
    return await es.search({ index, type: index });
  } catch (error) {
    await es.indices.create({ index });
    return null;
  }
}

export default async function startProjectApp({ es, id, io }) {
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  await setProjectActive({ id, es });

  const types = await getTypes({ id, es });
  if (!types) return;
  let hits = mapHits(types);
  let mappings = await fetchMappings({ es, types: hits });

  let extended = await Promise.all(
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

  let mockSchema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    mock: true,
  });

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
  if (!getProject(id) && body.length > 0) {
    await es.bulk({ body });
  }

  const projectApp = express.Router();

  projectApp.get(`/${id}/ping`, (req, res) => res.send('ok'));

  let noSchemaHandler = (req, res) =>
    res.json({
      error:
        'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
    });

  projectApp.use(
    `/mock/${id}/graphql`,
    mockSchema
      ? graphqlExpress({
          schema: mockSchema,
        })
      : noSchemaHandler,
  );

  projectApp.use(
    `/${id}/graphql`,
    schema
      ? graphqlExpress({ schema, context: { es, projectId: id, io } })
      : noSchemaHandler,
  );

  projectApp.use(`/${id}/download`, download({ projectId: id }));

  setProject(id, { app: projectApp, schema, es, io });

  io.emit('server::refresh');

  return projectApp;
}
