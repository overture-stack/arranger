import 'babel-polyfill';
import winston from 'winston';
import fs from 'fs';
import SchemaLister from './list-schemas';
import SchemaFaker from './schema-faker';
import SchemaTransformer from './schema-transformer';
import DataExporter from './export-data';

const tsFormat = () => new Date().toISOString();

let logger = new winston.Logger({
  transports: [
    new winston.transports.Console({ timestamp: tsFormat, colorize: true }),
  ],
});

logger.info('*** Fake Data Generation Begins ***');

let schemaLister = new SchemaLister(logger);

let schemas = schemaLister.list('./schemas');

Object.entries(schemas).forEach(([key, item]) => {
  try {
    if (key !== 'model.json') return;

    logger.info('Generating fake values for schema: ' + key);

    let transformer = new SchemaTransformer(logger);

    transformer.transform(item);

    let output = [];
    // generate 5000 data points
    for (var count = 0; count < 5000; count++) {
      let dataPoint = new SchemaFaker(item);
      output.push(dataPoint);
    }

    let exporter = new DataExporter(logger);
    exporter.writeToES(output);
  } catch (err) {
    logger.error(`Error processing schema for : ${key}. Details: ${err}`);
  }
});
