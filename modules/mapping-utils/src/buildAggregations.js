import { AggregationProcessor } from '@arranger/middleware'

export default ({ type, fields, graphql_fields, nested_fields, args }) =>
    new AggregationProcessor().buildAggregations({ type, fields, graphql_fields, nested_fields, args });
