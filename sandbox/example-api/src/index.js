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

        app.use(
          '/projects/add',
          bodyParser.json({ limit: '50mb' }),
          async (req, res) => {
            let { eshost: host, id } = req.body;

            if (!id) return res.json({ error: 'id cannot be empty' });

            // create es client from ip
            let es;
            try {
              es = new elasticsearch.Client({ host });
            } catch (error) {
              return res.json({ error: error.message });
            }

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
              await es.create({
                ...arrangerconfig.projectsIndex,
                refresh: true,
                id,
                body: {
                  id,
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
                res.json({ projects });
              } catch (error) {
                return res.json({ error: error.message });
              }
              return res.json({ error: error.message });
            }

            res.json({ projects: projects.hits.hits.map(x => x._source) });
          },
        );

        app.use(
          '/projects',
          bodyParser.json({ limit: '50mb' }),
          async (req, res) => {
            let { eshost: host } = req.body;

            // create es client from ip
            let es;
            try {
              es = new elasticsearch.Client({ host });
            } catch (error) {
              return res.json({ error: error.message });
            }

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
          },
        );

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
