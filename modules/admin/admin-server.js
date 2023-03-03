import express from 'express';
import adminGraphql from '@arranger/admin/dist/index.js';


import {
	ADMIN_SERVER_PORT,
  ELASTICSEARCH
} from './config.js';


// Admin GraphQL
const adminApp = await adminGraphql.default({ esHost: ELASTICSEARCH});

// Setup express server
const app = express();

// Apply middleware
adminApp.applyMiddleware({app, path: '/admin/graphql'})


app.listen(ADMIN_SERVER_PORT, () => {
	console.log(`Admin server running on ${ADMIN_SERVER_PORT}`);
});
