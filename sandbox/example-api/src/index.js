import fs from 'fs';
import { promisify } from 'util';
import elasticsearch from 'elasticsearch';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import uuid from 'uuid/v4';
import fetch from 'node-fetch';
import { range, flattenDeep } from 'lodash';
import bodyParser from 'body-parser';
import cors from 'cors';
import makeSchema from '@arranger/schema';
import { graphqlEndpoint, setupSocket } from '@arranger/server';
import {
  addMappingsToTypes,
  mappingToAggsState,
} from '@arranger/mapping-utils';

let app = express();
let http = Server(app);
let io = socketIO(http);

let writeFile = promisify(fs.writeFile);

let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(([, { index, es_type }]) =>
      es.indices.getMapping({
        index,
        type: es_type,
      }),
    ),
  );
};

// let writeMappingsToFiles = async ({ types, mappings }) =>
//   types.forEach(
//     async ([type], i) =>
//       await writeFile(
//         mappingFolder(type),
//         JSON.stringify(Object.values(mappings[i])[0].mappings, null, 2),
//       ),
//   )

let mapHits = x => x.hits.hits.map(x => x._source);

let main = async () => {
  if (process.env.WITH_ES) {
    let esconfig = {
      host: process.env.ES_HOST,
    };

    if (process.env.ES_USER && process.env.ES_PASSWORD) {
      esconfig.httpAuth = `${process.env.ES_USER}:${process.env.ES_PASSWORD}`;
    }

    if (process.env.ES_TRACE) esconfig.log = process.env.ES_TRACE;

    let es = new elasticsearch.Client(esconfig);

    es
      .ping({
        requestTimeout: 1000,
      })
      .then(async () => {
        let rootTypes = Object.entries(global.config.ROOT_TYPES);
        let types = Object.entries(global.config.ES_TYPES);
        let mappings = await fetchMappings({ types, es });
        let typesWithMappings = addMappingsToTypes({ types, mappings });
        let schema = makeSchema({ types: typesWithMappings, rootTypes });

        let fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        setupSocket({ io });

        // TODO: if exists, diff against state(s)?

        let body = flattenDeep(
          typesWithMappings.map(([type, props]) => [
            {
              index: {
                _index: `${type}-aggs-state`,
                _type: `${type}-aggs-state`,
                _id: uuid(),
              },
            },
            JSON.stringify({
              timestamp: new Date().toISOString(),
              state: mappingToAggsState(props.mapping),
            }),
          ]),
        );

        await es.bulk({ body });

        app.use(cors());
        app.use(bodyParser.json({ limit: '50mb' }));

        // create request context
        app.use((req, res, next) => {
          req.context = {};
          next();
        });

        // create es client
        app.use(async (req, res, next) => {
          let { eshost: host } = req.body;
          if (!host) return res.json({ error: 'host must be provided' });
          try {
            req.context.es = new elasticsearch.Client({ host });
          } catch (error) {
            return res.json({ error: error.message });
          }
          next();
        });

        app.use('/projects/:id/types/add', async (req, res) => {
          let { es } = req.context;
          let { id } = req.params;
          let { index, name } = req.body;

          if (!id || !index || !name) {
            return res.json({ error: 'missing fields' });
          }

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

          res.json({ types: mapHits(types) });
        });

        app.use('/projects/:id/types', async (req, res) => {
          let { es } = req.context;
          let { id } = req.params;
          if (!id) return res.json({ error: 'project empty' });

          let arrangerconfig = {
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

          res.json({ types: mapHits(types) });
        });

        app.use('/projects/add', async (req, res) => {
          let { es } = req.context;
          let { id } = req.body;

          if (!id) return res.json({ error: 'id cannot be empty' });

          let projects = [];

          let arrangerconfig = {
            projectsIndex: {
              index: 'arranger-projects',
              type: 'arranger-projects',
            },
          };

          try {
            await es.create({
              ...arrangerconfig.projectsIndex,
              refresh: true,
              id,
              body: {
                id,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (error) {
            return res.json({ error: error.message });
          }

          try {
            projects = await es.search(arrangerconfig.projectsIndex);
          } catch (error) {
            try {
              await es.indices.create({
                index: arrangerconfig.projectsIndex.index,
              });
              return res.json({ projects });
            } catch (error) {
              return res.json({ error: error.message });
            }
            return res.json({ error: error.message });
          }

          res.json({ projects: mapHits(projects) });
        });

        app.use('/projects', async (req, res) => {
          let { es } = req.context;
          // create arranger-projects index
          // get arranger projects

          let projects = [];

          let arrangerconfig = {
            projectsIndex: {
              index: 'arranger-projects',
              type: 'arranger-projects',
            },
          };

          try {
            projects = await es.search(arrangerconfig.projectsIndex);
          } catch (error) {
            try {
              await es.indices.create({
                index: arrangerconfig.projectsIndex.index,
              });
              res.json({ projects });
            } catch (error) {
              return res.json({ error: error.message });
            }
            return res.json({ error: error.message });
          }

          res.json({ projects: projects.hits.hits.map(x => x._source) });
        });

        graphqlEndpoint({ http, app, schema, context: { es, io } });
      })
      .catch(err => {
        console.log(err);
        graphqlEndpoint({ schema });
      });
  } else {
    let schema = makeSchema({ mock: true });
    graphqlEndpoint({ schema });
  }
};

main();
