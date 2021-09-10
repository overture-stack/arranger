// @flow
import { get } from 'lodash';

import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';
import { fetchMapping } from './utils/fetchMapping';
import loadExtendedFields from './utils/loadExtendedFields';
import esSearch from './utils/esSearch';

type TcreateConnectionResolversArgs = {
  type: Object,
};
type TcreateConnectionResolvers = (args: TcreateConnectionResolversArgs) => Object;

let createConnectionResolvers: TcreateConnectionResolvers = ({
  type,
  indexPrefix,
  createStateResolvers = true,
  Parallel,
  getServerSideFilter,
}) => ({
  [type.name]: {
    mapping: async (obj, { indices }, { es, projectId }) => {
      const { index, es_type: esType } = type;
      const { mapping: esMapping } = await fetchMapping({ index, esType, es });
      const mappings = esMapping[Object.keys(esMapping)[0]].mappings.properties;
      return mappings;
    },
    extended: async (obj, { fields }, { es, projectId }) => {
      const { index } = type;
      const extendedFields = await loadExtendedFields({ es, projectId, index });
      return fields ? extendedFields.filter((x) => fields.includes(x.field)) : extendedFields;
    },
    ...(createStateResolvers
      ? {
          aggsState: async (obj, { indices }, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              const data = await esSearch(es)({
                index: `${type.indexPrefix}-aggs-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await esSearch(es)({
                index: `arranger-projects-${projectId}`,
              });
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) => _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['aggs-state'];
            }
          },
          columnsState: async (obj, t, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              const data = await esSearch(es)({
                index: `${type.indexPrefix}-columns-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await esSearch(es)({
                index: `arranger-projects-${projectId}`,
              });
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) => _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['columns-state'];
            }
          },
          matchBoxState: async (obj, t, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              let data = await esSearch(es)({
                index: `${type.indexPrefix}-matchbox-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await esSearch(es)({
                index: `arranger-projects-${projectId}`,
              });
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) => _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['matchbox-state'];
            }
          },
        }
      : {}),
    hits: resolveHits({ type, Parallel, getServerSideFilter }),
    aggregations: resolveAggregations({ type, getServerSideFilter }),
  },
});

export default createConnectionResolvers;
