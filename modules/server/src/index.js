import fs from 'fs';
import { promisify } from 'util';
import elasticsearch from 'elasticsearch';
import { rainbow } from 'chalk-animation';
import { Server } from 'http';
import express from 'express';
import socketIO from 'socket.io';
import uuid from 'uuid/v4';
import fetch from 'node-fetch';
import { range, flattenDeep } from 'lodash';
import bodyParser from 'body-parser';
import cors from 'cors';
import { graphqlExpress } from 'apollo-server-express';
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
} from '@arranger/mapping-utils';

let writeFile = promisify(fs.writeFile);

let fetchMapping = ({ index, es }) => {
  // TODO: check for aliases!!
  return es.indices
    .getMapping({
      index,
      type: index,
    })
    .catch(err => {
      // TODO: return something more useful than false
      return false;
    })
    .then(val => {
      return { index: index, mapping: val };
    });
};

let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(({ index }) => {
      return fetchMapping({ index, es });
    }),
  );
};

let mapHits = x => x.hits.hits.map(x => x._source);

let port = process.env.PORT || 5050;

let main = async () => {
  let app = express();
  let http = Server(app);
  let io = socketIO(http);

  let connections = [];

  io.on('connection', socket => {
    connections.push(socket);

    socket.on('arranger::monitorProjects', ({ projects = [], eshost }) => {
      socket.monitorIntervalId = setInterval(async () => {
        let statuses = await Promise.all(
          projects.map(x =>
            fetch(`http://localhost:${port}/${x.id}/ping`, {
              headers: {
                ES_HOST: eshost,
              },
            })
              .then(r => {
                if (r.ok) return r.text();
              })
              .then(r => {
                return { [x.id]: r === 'ok' };
              })
              .catch(() => ({ [x.id]: false })),
          ),
        );

        socket.emit('server::projectsStatus', statuses);
      }, 3000);
    });
  });

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  // create request context
  app.use((req, res, next) => {
    req.context = {};
    next();
  });

  // create es client
  app.use(async (req, res, next) => {
    let { eshost } = req.body;
    let host = eshost || req.get('ES_HOST');
    if (!host) return res.json({ error: 'host must be provided' });
    try {
      req.context.es = new elasticsearch.Client({ host });
    } catch (error) {
      return res.json({ error: error.message });
    }
    next();
  });

  app.use('/projects/:id/types/:index/fields', async (req, res) => {
    let { es } = req.context;
    let { id, index } = req.params;

    if (!id || !index) {
      return res.json({ error: 'missing fields' });
    }

    let arrangerconfig = {
      projectsIndex: {
        index: `arranger-projects-${id}-${index}`,
        type: `arranger-projects-${id}-${index}`,
      },
    };

    let fields = [];

    try {
      fields = await es.search(arrangerconfig.projectsIndex);
    } catch (error) {
      try {
        await es.indices.create({
          index: arrangerconfig.projectsIndex.index,
        });

        // TODO: check for aliases!!
        let mappings = await es.indices.getMapping({
          index,
          type: index,
        });

        let mapping = mappings[index].mappings[index].properties;

        let fields = mappingToAggsState(mapping);

        let body = flattenDeep(
          fields.map(x => [
            {
              index: {
                _index: arrangerconfig.projectsIndex.index,
                _type: arrangerconfig.projectsIndex.index,
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
      return res.json({ error: error.message });
    }

    res.json({ fields: mapHits(fields), total: fields.hits.total });
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

    let hits = mapHits(types);

    let mappings = await fetchMappings({ es, types: hits });

    res.json({
      types: hits.map(x => ({
        ...x,
        mappings: mappings.find(y => y.index === x.index).mapping,
      })),
      total: types.hits.total,
    });
  });

  app.use('/projects/:id/spinup', async (req, res) => {
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

    let hits = mapHits(types);

    let mappings = await fetchMappings({ es, types: hits });

    res.json({
      types: hits.map(x => ({
        ...x,
        mappings: mappings.find(y => y.index === x.index).mapping,
      })),
      total: types.hits.total,
    });
  });

  app.use('/projects/:id/delete', async (req, res) => {
    let { es } = req.context;
    let { id } = req.params;

    if (!id) return res.json({ error: 'id cannot be empty' });

    let projects = [];

    let arrangerconfig = {
      projectsIndex: {
        index: 'arranger-projects',
        type: 'arranger-projects',
      },
    };

    try {
      await es.delete({
        ...arrangerconfig.projectsIndex,
        refresh: true,
        id,
      });
      await es.indices.delete({
        index: `arranger-projects-${id}`,
      });
    } catch (error) {
      return res.json({ error: error.message });
    }

    try {
      projects = await es.search({
        ...arrangerconfig.projectsIndex,
        size: 1000,
      });
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

    res.json({ projects: mapHits(projects), total: projects.hits.total });
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
          active: false,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return res.json({ error: error.message });
    }

    try {
      projects = await es.search({
        ...arrangerconfig.projectsIndex,
        size: 1000,
      });
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

    res.json({ projects: mapHits(projects), total: projects.hits.total });
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
        size: 1000,
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

    res.json({
      projects: projects.hits.hits.map(x => x._source),
      total: projects.hits.total,
    });
  });

  http.listen(port, () => rainbow(`⚡️ Listening on port ${port} ⚡️`));
};

main();
