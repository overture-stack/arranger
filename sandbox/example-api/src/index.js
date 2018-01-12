import fs from 'fs';
import { promisify } from 'util';
import elasticsearch from 'elasticsearch';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import uuid from 'uuid/v4';
import fetch from 'node-fetch';
import { range, flattenDeep } from 'lodash';
import makeSchema from '@arranger/schema';
import server from '@arranger/server';
import {
  addMappingsToTypes,
  mappingToAggsState,
  mappingToColumnsState,
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

        io.on('connection', socket => {
          socket.on(
            'client::stream',
            async ({ index, filters = null, size = 100, fields = '' }) => {
              let { data } = await fetch('http://localhost:5050', {
                ...fetchOptions,
                body: JSON.stringify({
                  variables: { filters },
                  query: `
                  query ($filters: JSON) {
                    ${index} {
                      hits(filters: $filters) {
                        total
                      }
                    }
                  }
                `,
                }),
              }).then(r => r.json());

              let total = data[index].hits.total;
              let steps = range(0, Math.round(total / size));

              steps.forEach(async (x, i) => {
                fetch('http://localhost:5050', {
                  ...fetchOptions,
                  body: JSON.stringify({
                    variables: { first: size, offset: x * size },
                    query: `
                    query ($first: Int, $offset: Int) {
                      ${index} {
                        hits(first: $first, offset: $offset) {
                          edges {
                            node {
                              ${fields}
                            }
                          }
                        }
                      }
                    }
                  `,
                  }),
                })
                  .then(r => r.json())
                  .then(({ data }) => {
                    socket.emit('server::chunk', {
                      data,
                      complete: i === steps.length - 1,
                    });
                  });
              });
            },
          );
        });

        // TODO: if exists, diff against state(s)?

        let body = flattenDeep(
          typesWithMappings.map(([type, props]) => {
            const columns = mappingToColumnsState(props.mapping);

            return [
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
              {
                index: {
                  _index: `${type}-columns-state`,
                  _type: `${type}-columns-state`,
                  _id: uuid(),
                },
              },
              JSON.stringify({
                timestamp: new Date().toISOString(),
                type,
                keyField: type.replace(/(s|_.*)$/, '') + '_id', // TODO: find better way to generate this
                defaultSorted: [
                  {
                    id: columns[0].id || columns[0].accessor,
                    desc: false,
                  },
                ],
                columns,
              }),
            ];
          }),
        );

        await es.bulk({ body });

        server({ http, app, schema, context: { es, io } });
      })
      .catch(err => {
        console.log(err);
        server({ schema });
      });
  } else {
    let schema = makeSchema({ mock: true });
    server({ schema });
  }
};

main();
