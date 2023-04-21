import express from 'express';
import cors from 'cors';
import { Client } from '@elastic/elasticsearch';
import { ApolloServer } from 'apollo-server-express';
import { downloader } from './export/export-file.js';
import { decodeToken, memoizedProcess } from './authFilter.js';
import { ARRANGER_PROJECT_ID, ELASTICSEARCH, SERVER_PORT } from './config.js';

// We need to pull the createProjectSchema method out of the arranger server dist because this gives us access to the `getServerSideFilter` method
import { createProjectSchema } from '@arranger/server/dist/startProject.js';

// Manually create ES Client, as we need to give arranger access to it directly
const esClient = new Client({
    node: ELASTICSEARCH
});

/**
 * Execute server filter on the incoming request
 * @param req request from express server
 * @param res response from express server
 * @param next next middleware function from express server
 */

async function serverFilter(req, res, next) {
    const invalid_sqon = {
        "op": "and",
        "content": [{
            "op": "in",
            "content": {
                "field": "container_code",
                "value": ["no_permissions"]
            }
        }]
    }
    try {
        if ((!req.headers.authorization) || (!req.body.project_code)) {
            req.sqon = invalid_sqon;
        } else {
            const decoded = decodeToken(req)
            const project_code = req.body['project_code'];
            const username = decoded['username']
            const realm_roles = decoded['roles']
            req.sqon = await memoizedProcess(project_code, username, JSON.stringify(req.body), realm_roles)

        }
    } catch (error) {
        console.error(`Failed to execute server filter: ${error.message} `)
        req.sqon = invalid_sqon
    }
    next()
}

/**
 * Retrieve sqon from RBAC filter
 * @param context The context provided by the ApolloServer based on the incoming request
 * @returns a SQON filter to apply to the entire request and to all aggregations
 */
function SQONFilter(context) {
    return context.req.sqon
}

// Schema for server-side filtering
const arrangerSchema = await createProjectSchema({
    es: esClient,
    id: ARRANGER_PROJECT_ID,
    graphqlOptions: {},
    enableAdmin: false,
    getServerSideFilter: SQONFilter,
})

// Schema for download functionality
const arrangerSchemaDownload = await createProjectSchema({
    es: esClient,
    id: ARRANGER_PROJECT_ID,
    graphqlOptions: {},
    enableAdmin: false,
})

// Setup Apollo Server
const server = new ApolloServer({
    schema: arrangerSchema['schema'],
    context: ({
        req
    }) => {
        return {
            es: esClient,
            req,
            projectId: ARRANGER_PROJECT_ID
        };
    }
})

// Setup express server
const app = express();
app.use(express.json()); // support json encoded bodies

// Use serverFilter for incoming requests
app.use(serverFilter)

// Enable all CORS requests
app.use(cors())

// Add Arranger middleware
server.applyMiddleware({
    app,
    path: `/${ARRANGER_PROJECT_ID}/graphql`
});
server.applyMiddleware({
    app,
    path: `/${ARRANGER_PROJECT_ID}/graphql/*`
});

// Enable export file
app.use(`/${ARRANGER_PROJECT_ID}/download`, downloader({
    projectId: ARRANGER_PROJECT_ID,
    es: esClient,
    arranger_schema: arrangerSchemaDownload
}))

// Start express server
app.listen(SERVER_PORT, () => {
    console.log(`Arranger server running on ${SERVER_PORT}`);
});
