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
import makeSchema from '@arranger/schema';
import {
  addMappingsToTypes,
  mappingToAggsState,
} from '@arranger/mapping-utils';

let writeFile = promisify(fs.writeFile);

let fetchMapping = ({ index, es }) => {
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

    let hits = mapHits(types);
    let mappings = await fetchMappings({ es, types: hits });
    types = hits.map(x => {
      return {
        ...x,
        mappings: mappings.find(y => y.index === x.index).mapping,
      };
    })
    res.json({ types });
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
