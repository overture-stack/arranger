import express from 'express';
import { Client } from '@elastic/elasticsearch';
import {ApolloServer} from 'apollo-server-express';
import {arrangerAuthFilter} from './authFilter.js';
import {downloader} from "./export/export-file.js";

import {
	ARRANGER_PROJECT_ID,
	PORT,
  ELASTICSEARCH
} from './config.js';
// We need to pull the createProjectSchema method out of the arranger server dist because this gives us access to the `getServerSideFilter` method
import { createProjectSchema } from '@arranger/server/dist/startProject.js';


/**
 * This is the filter you want to apply based on the incoming request
 * @param context This is the context provided by the ApolloServer based on the incoming request, see the `context` property of the ApolloServer. In this example, we provide the entire request so you can pull out any headers with auth information you want to use to construct a filter with.
 * @returns a SQON filter to apply to the entire request and to all aggregations
 */
const arrangerFilterFromContext = (context) => (arrangerAuthFilter(context));

// Manually create ES Client, we need to give arranger this access directly
const esClient = new Client({node: ELASTICSEARCH});

// Schema for server-side filtering
const arrangerSchema = await createProjectSchema({
	es: esClient,
	id: ARRANGER_PROJECT_ID,
	graphqlOptions: {},
	enableAdmin: false,
	getServerSideFilter: arrangerFilterFromContext,
})

// Schema for download functionality
const arrangerSchemaDownload = await createProjectSchema({
	es: esClient,
	id: ARRANGER_PROJECT_ID,
	graphqlOptions: {},
	enableAdmin: false,
})


const server = new ApolloServer({
	schema: arrangerSchema['schema'],
	context: ({ req }) => {
		return {es: esClient, req, projectId: ARRANGER_PROJECT_ID};
	}
})

// Setup express server
const app = express();

// Add Arranger middleware
server.applyMiddleware({ app, path: `/${ARRANGER_PROJECT_ID}/graphql`});
server.applyMiddleware({ app, path: `/${ARRANGER_PROJECT_ID}/graphql/*`});


// Enable export file
app.use(`/${ARRANGER_PROJECT_ID}/download`, downloader({ projectId: ARRANGER_PROJECT_ID, es: esClient,
arranger_schema: arrangerSchemaDownload}))

app.listen(PORT, () => {
	console.log(`Server running on ${PORT}`);
});
