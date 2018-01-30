import { AggregationProcessor } from '@arranger/middleware'

export default ({ nested_fields, aggs }) =>
    new AggregationProcessor().pruneAggregations({ aggs, nested_fields });
