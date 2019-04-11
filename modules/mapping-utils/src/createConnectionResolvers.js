// @flow
import { get } from 'lodash';

import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';
import { fetchMapping } from './utils/fetchMapping';
import loadExtendedFields from './utils/loadExtendedFields';

type TcreateConnectionResolversArgs = {
  type: Object,
};
type TcreateConnectionResolvers = (
  args: TcreateConnectionResolversArgs,
) => Object;

let createConnectionResolvers: TcreateConnectionResolvers = ({
  type,
  indexPrefix,
  createStateResolvers = true,
  Parallel,
}) => ({
  [type.name]: {
    mapping: async (obj, { indices }, { es, projectId }) => {
      const { index, es_type: esType } = type;
      const { mapping: esMapping } = await fetchMapping({ index, esType, es });
      const mappings =
        esMapping[Object.keys(esMapping)[0]].mappings[esType].properties;
      return mappings;
    },
    extended: async (obj, { fields }, { es, projectId }) => {
      const { index } = type;
      const extendedFields = await loadExtendedFields({ es, projectId, index });
      return fields
        ? extendedFields.filter(x => fields.includes(x.field))
        : extendedFields;
    },
    ...(createStateResolvers
      ? {
          aggsState: async (obj, { indices }, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              const data = await es.search({
                index: `${type.indexPrefix}-aggs-state`,
                type: `${type.indexPrefix}-aggs-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await es.search({
                index: `arranger-projects-${projectId}`,
                type: `arranger-projects-${projectId}`,
              });
              // const config = get(metaData, 'hits.hits[0]._source.config');
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) =>
                  _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['aggs-state'];
            }
          },
          columnsState: async (obj, t, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              const data = await es.search({
                index: `${type.indexPrefix}-columns-state`,
                type: `${type.indexPrefix}-columns-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await es.search({
                index: `arranger-projects-${projectId}`,
                type: `arranger-projects-${projectId}`,
              });
              // const config = get(metaData, 'hits.hits[0]._source.config');
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) =>
                  _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['columns-state'];
            }
          },
          matchBoxState: async (obj, t, { es, projectId }) => {
            const { index, es_type: esType } = type;
            try {
              let data = await es.search({
                index: `${type.indexPrefix}-matchbox-state`,
                type: `${type.indexPrefix}-matchbox-state`,
                body: {
                  sort: [{ timestamp: { order: 'desc' } }],
                  size: 1,
                },
              });
              return get(data, 'hits.hits[0]._source', null);
            } catch (err) {
              const metaData = await es.search({
                index: `arranger-projects-${projectId}`,
                type: `arranger-projects-${projectId}`,
              });
              // const config = get(metaData, 'hits.hits[0]._source.config');
              const projectIndexData = get(metaData, 'hits.hits').find(
                ({ _source }) =>
                  _source.index === index && _source.esType === esType,
              )._source;
              return projectIndexData.config['matchbox-state'];
            }
          },
        }
      : {}),
    hits: resolveHits({ type, Parallel }),
    aggregations: resolveAggregations(type),
  },
});

export default createConnectionResolvers;
