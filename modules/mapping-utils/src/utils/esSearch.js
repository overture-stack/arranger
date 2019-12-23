import { Client, RequestParams } from '@elastic/elasticsearch';

/**
 * @param {Client} es
 */
export default es => {
  /**
   * @param {RequestParams.Search} params
   */
  const output = async params => (await es.search(params)).body;
  return output;
};
