import { BaseSQON } from './sqon/base_sqon.js';

/**
 * Function will create custom SQON filter
 * @returns a JSON encoded SQON filter to apply to graphql query, including aggregations
 */

export async function arrangerFilter() {
  return BaseSQON.generate();
}

/**
 * Function will process incoming request to obtain SQON filter
 * @returns a JSON encoded SQON filter to apply to graphql query, including aggregations
 */

export async function processRequest() {
  return await arrangerFilter();
}
