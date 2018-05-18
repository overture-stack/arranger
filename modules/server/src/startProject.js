import { graphqlExpress } from 'apollo-server-express';
import uuid from 'uuid/v4';
import { flattenDeep, get } from 'lodash';
import express from 'express';
import makeSchema from '@arranger/schema';
import {
  extendFields,
  addMappingsToTypes,
  mappingToAggsState,
  mappingToColumnsState,
  mappingToMatchBoxState,
} from '@arranger/mapping-utils';
import { fetchMappings } from './utils/fetchMappings';
import mapHits from './utils/mapHits';
import { getProject, setProject } from './utils/projects';
import download from './download';
import getIndexPrefix from './utils/getIndexPrefix';
import { setsMapping } from '@arranger/schema';
import { CONSTANTS } from '@arranger/middleware';

async function getTypes({ id, es }) {
  const index = `arranger-projects-${id}`;

  try {
    return await es.search({ index, type: index });
  } catch (error) {
    await es.indices.create({ index });
    return null;
  }
}

const initializeSets = async ({ es }) => {
  if (!await es.indices.exists({ index: CONSTANTS.ES_ARRANGER_SET_INDEX })) {
    await es.indices.create({
      index: CONSTANTS.ES_ARRANGER_SET_INDEX,
      body: {
        mappings: {
          [CONSTANTS.ES_ARRANGER_SET_TYPE]: {
            properties: setsMapping,
          },
        },
      },
    });
  }
};

export default async function startProjectApp({
  es,
  id,
  io,
  graphqlMiddleware = [],
}) {
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  const types = await getTypes({ id, es });

  if (!types) return;
  let hits = mapHits(types);
  let mappings = await fetchMappings({ es, types: hits });

  let extended = await Promise.all(
    hits.map(async type => {
      const indexPrefix = getIndexPrefix({ projectId: id, index: type.index });
      let fields = await es.search({
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

      fields = extendFields(mapHits(fields));

      return { ...type, indexPrefix, fields };
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
          indexPrefix: type.indexPrefix,
        },
      ];
    }),
    mappings: mappings.map(m => m.mapping),
  });

  let schema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    middleware: graphqlMiddleware,
  });

  let mockSchema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    mock: true,
  });

  const createAggsState = typesWithMappings.map(async ([type, props]) => {
    const index = `${props.indexPrefix}-aggs-state`;
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
    const index = `${props.indexPrefix}-columns-state`;

    const existing = get(
      await es
        .search({
          index,
          type: index,
          body: {
            sort: [{ timestamp: { order: 'desc' } }],
            size: 1,
          },
        })
        .catch(e => null),
      'hits.hits[0]._source',
    );

    const existingColumns = get(existing, 'state.columns') || [];
    const newColumns = columns.filter(
      c => !existingColumns.find(e => e.field === c.field),
    );

    return !existing || newColumns.length
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
              ...(get(existing, 'state') || {}),
              columns: [...existingColumns, ...newColumns],
            },
          }),
        ]
      : [];
  });

  const createMatchBoxState = typesWithMappings.map(async ([type, props]) => {
    const index = `${props.indexPrefix}-matchbox-state`;
    const count = await es
      .count({ index, type: index })
      .then(d => d.count, () => 0);
    return count === 0
      ? [
          { index: { _index: index, _type: index, _id: uuid() } },
          JSON.stringify({
            timestamp: new Date().toISOString(),
            state: mappingToMatchBoxState(props),
          }),
        ]
      : [];
  });

  await initializeSets({ es });

  let body = flattenDeep(
    await Promise.all([
      ...createAggsState,
      ...createColumnsState,
      ...createMatchBoxState,
    ]),
  );

  // TODO: don't add new ui states if decomissioned
  if (!getProject(id) && body.length > 0) {
    await es.bulk({ body });
  }

  const projectApp = express.Router();

  projectApp.get(`/ping`, (req, res) => res.send('ok'));

  let noSchemaHandler = (req, res) =>
    res.json({
      error:
        'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
    });

  projectApp.use(
    `/mock/graphql`,
    mockSchema
      ? graphqlExpress({
          schema: mockSchema,
        })
      : noSchemaHandler,
  );

  projectApp.use(
    `/graphql`,
    schema
      ? graphqlExpress({ schema, context: { es, projectId: id, io } })
      : noSchemaHandler,
  );

  projectApp.use(`/download`, download({ projectId: id, io }));

  setProject({ app: projectApp, schema, mockSchema, es, io, id });

  io.emit('server::refresh');

  return projectApp;
}
