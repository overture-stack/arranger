import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';

type TcreateConnectionResolversArgs = {
  type: Object,
};
type TcreateConnectionResolvers = (
  args: TcreateConnectionResolversArgs,
) => Object;
let createConnectionResolvers: TcreateConnectionResolvers = ({ type }) => ({
  [type.name]: {
    mapping: () => {
      // TODO: stitch extended mapping
      return type.mapping;
    },
    extended: (obj, { fields }) => {
      return fields
        ? type.extendedFields.filter(x => fields.includes(x.field))
        : type.extendedFields;
    },
    hits: resolveHits(type),
    aggregations: resolveAggregations(type),
  },
  [type.name + 'Connection']: {
    edges: edges => edges.hits,
  },
  [type.name + 'Edge']: {
    node: node => node,
  },
});

export default createConnectionResolvers;
