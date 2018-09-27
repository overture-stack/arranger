import { gql } from 'apollo-server';
import * as convert from 'convert-units';

export default async () => gql`
  enum ExtendedFieldType {
    string
    object
    text
    boolean
    date
    keyword
    id
    long
    double
    integer
    float
  }
  enum NumericTypeUnit {
    ${convert().measure()}
  }

  type ExtendedMapping {
    field: String!
    type: ExtendedFieldType
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: NumericTypeUnit
    displayValues: JSON
    rangeStep: Float
  }
  type Query {
    extendedMapping(
      projectId: String!
      graphqlField: String!
      field: String
    ): [ExtendedMapping]
  }

  input ExtendedMappingInput {
    type: ExtendedFieldType
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: NumericTypeUnit
    displayValues: JSON
    rangeStep: Float
  }

  type Mutation {
    updateExtendedMapping(
      projectId: String!
      graphqlField: String!
      field: String!
      extendedMappingInput: ExtendedMappingInput!
    ): ExtendedMapping
  }
`;
