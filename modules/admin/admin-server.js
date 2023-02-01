import express from 'express';
import adminGraphql from '@arranger/admin/dist/index.js';


import {
	PORT,
  ELASTICSEARCH
} from './config.js';


// Admin GraphQL
const adminApp = await adminGraphql.default({ esHost: ELASTICSEARCH});

// Setup express server
const app = express();

// Apply middleware
adminApp.applyMiddleware({app, path: '/admin/graphql'})


app.listen(PORT, () => {
	console.log(`Admin server running on ${PORT}`);
});
