import resolveAggregations from './resolveAggregations';
import resolveHits from './resolveHits';

// TODO: tighten these types
type TcreateConnectionResolversArgs = {
  createStateResolvers?: boolean;
  getServerSideFilter: any;
  Parallel: any;
  type: Record<string, any>;
};
type TcreateConnectionResolvers = (args: TcreateConnectionResolversArgs) => Record<string, any>;

let createConnectionResolvers: TcreateConnectionResolvers = ({
  createStateResolvers = true,
  getServerSideFilter,
  Parallel,
  type,
}) => ({
  [type.name]: {
    mapping: async () => {
      return type.mapping;
    },
    extended: async (obj, { fields }) => {
      return fields
        ? type.extendedFields.filter((extendedField) => fields.includes(extendedField.field))
        : type.extendedFields;
    },
    ...(createStateResolvers
      ? {
          aggsState: async (obj, t, ctx) => {
            return {
              state: type.config?.['aggs-state'],
            };
          },
          columnsState: async (obj, t, ctx) => {
            return {
              state: type.config?.['columns-state'],
            };
          },
          matchBoxState: async (obj, t, ctx) => {
            return {
              state: type.config?.['matchbox-state'],
            };
          },
        }
      : {}),
    hits: resolveHits({ type, Parallel, getServerSideFilter }),
    aggregations: resolveAggregations({ type, getServerSideFilter }),
  },
});

export default createConnectionResolvers;
