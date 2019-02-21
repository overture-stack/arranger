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
import getTypes from './utils/getTypes';
import replaceBy from './utils/replaceBy';

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

const mergeFieldsFromConfig = (generatedFields, configFields) => {
  const a = generatedFields || [];
  const b = configFields || [];
  return [
    ...b.filter(x => a.find(y => y.field === x.field)),
    ...a.filter(x => !b.find(y => y.field === x.field)),
  ];
};

export const createProjectEndpoint = async ({
  es,
  id,
  graphqlOptions = {},
  enableAdmin,
  typesWithMappings,
}) => {
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  const types = await getTypes({ id, es });

  if (!types) return;
  const schema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    middleware: graphqlOptions.middleware || [],
    enableAdmin,
  });

  const mockSchema = makeSchema({
    types: typesWithMappings,
    rootTypes: [],
    mock: true,
  });

  await initializeSets({ es });

  const projectApp = express.Router();

  projectApp.use(`/`, (req, res, next) => {
    req.context = req.context || {};
    req.context.es = es;
    next();
  });

  projectApp.get(`/ping`, (req, res) => res.send({ status: 'ok' }));

  const noSchemaHandler = (req, res) =>
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
      ? graphqlExpress(async (request, response, graphQLParams) => {
          const externalContext =
            typeof graphqlOptions.context === 'function'
              ? await graphqlOptions.context(request, response, graphQLParams)
              : graphqlOptions.context;
          return {
            schema,
            context: {
              es,
              projectId: id,
              ...(externalContext || {}),
            },
          };
        })
      : noSchemaHandler,
  );

  projectApp.use(`/download`, download({ projectId: id }));

  setProject({ app: projectApp, schema, mockSchema, es, id });
  console.log(`graphql server running at /${id}/graphql`);

  return projectApp;
};

const initializeStates = async ({
  mappings,
  typesWithMappings,
  es,
  projectId,
}) => {
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
            state: mergeFieldsFromConfig(
              mappingToAggsState(props.mapping),
              props.config['aggs-state'],
            ),
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
              ...(props.config['columns-state'] || {}),
              columns: mergeFieldsFromConfig(
                [...existingColumns, ...newColumns],
                props.config['columns-state']?.columns,
              ),
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
            state: replaceBy(
              mappingToMatchBoxState(props),
              props.config['matchbox-state'],
              (x, y) => x.field === y.field,
            ),
          }),
        ]
      : [];
  });

  let body = flattenDeep(
    await Promise.all([
      ...createAggsState,
      ...createColumnsState,
      ...createMatchBoxState,
    ]),
  );

  // TODO: don't add new ui states if decomissioned
  if (!getProject(projectId) && body.length > 0) {
    await es.bulk({ body });
  }
};

export default async function startProjectApp({
  es,
  id,
  graphqlOptions = {},
  enableAdmin,
}) {
  if (!id) throw new Error('project empty');

  // indices must be lower cased
  id = id.toLowerCase();

  const types = await getTypes({ id, es });

  if (!types) return;
  const hits = mapHits(types);
  const mappings = await fetchMappings({ es, types: hits });

  const extended = await Promise.all(
    hits.map(async type => {
      const indexPrefix = getIndexPrefix({ projectId: id, index: type.index });
      try {
        const size = (await es.search({
          index: indexPrefix,
          type: indexPrefix,
          size: 0,
          _source: false,
        })).hits.total;

        const fields = extendFields(
          mapHits(
            await es.search({
              index: indexPrefix,
              type: indexPrefix,
              size: size,
            }),
          ),
        );

        return { ...type, indexPrefix, fields };
      } catch (err) {
        const fields = type.config.extended;
        return { ...type, indexPrefix, fields };
      }
    }),
  );
  const typesWithMappings = addMappingsToTypes({
    types: extended.map(type => {
      return [
        type.name,
        {
          index: type.index,
          es_type: type.esType,
          name: type.name,
          extendedFields: type.fields,
          customFields: ``,
          indexPrefix: type.indexPrefix,
          config: type.config || {},
        },
      ];
    }),
    mappings: mappings.map(m => m.mapping),
  });

  await Promise.all([
    initializeSets({ es }),
    enableAdmin
      ? initializeStates({
          es,
          projectId: id,
          typesWithMappings,
          mappings,
        })
      : Promise.resolve(),
  ]);

  return await createProjectEndpoint({
    es,
    id,
    graphqlOptions,
    enableAdmin,
    typesWithMappings,
  });
}
