import 'babel-polyfill';
import winston from 'winston';
import fs from 'fs';
import axios from 'axios';
import urlJoin from 'url-join';
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

function schemaFromFile() {
  let schemaLister = new SchemaLister(logger);
  let schemas = schemaLister.list('./schemas');

  return (Object.entries(schemas).find(
    ([key]) => key === `${process.env.ES_INDEX}.json`,
  ) || [])[1];
}

async function schemaFromMapping() {
  const {
    data: {
      [process.env.ES_INDEX]: { mappings: { [process.env.ES_TYPE]: mapping } },
    },
  } = await axios.get(
    urlJoin(
      process.env.ES_HOST,
      process.env.ES_INDEX,
      process.env.ES_TYPE,
      '_mapping',
    ),
  );

  return mapping;
}

async function main() {
  try {
    logger.info('*** Fake Data Generation Begins ***');
    let index = process.env.ES_INDEX;

    let schema = process.env.FROM_MAPPING
      ? await schemaFromMapping()
      : schemaFromFile();

    logger.info('Generating fake values for schema: ' + index);

    let transformer = new SchemaTransformer(logger);
    transformer.transform(schema);

    let output = [];
    // generate 5000 data points
    for (var count = 0; count < 5000; count++) {
      let dataPoint = new SchemaFaker(schema);
      output.push(dataPoint);
    }

    let exporter = new DataExporter(logger);
    exporter.writeToES(output);
  } catch (err) {
    logger.error(`Error processing schema for : ${index}. Details: ${err}`);
  }
}

main();
