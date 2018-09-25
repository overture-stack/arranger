import { gql } from 'apollo-server';

export default gql`
  type AggState {
    field: String
    type: String
      @deprecated(
        reason: "This field is deprecated in favour of client-side deduction of the type using the es mapping and @arranger/mapping-utils/esToAggTypeMap. This computation will already be done with @Arranger/components. Projects created with 0.4.6 will return null for this query"
      )
    active: Boolean
    show: Boolean
  }

  type AggsState {
    timestamp: String
    state: [AggState]
  }

  input AggStateInput {
    field: String
    active: Boolean
    show: Boolean
  }

  type Mutation {
    saveAggsState(graphlField: String!, state: AggStateInput!): AggsState
  }
  type Query {
    aggsState: AggsState
  }
`;
