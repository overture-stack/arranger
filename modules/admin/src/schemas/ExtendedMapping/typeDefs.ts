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
    ${convert().measures()}
  }

  type ExtendedFieldMapping {
    field: String!
    type: ExtendedFieldType!
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: NumericTypeUnit
    displayValues: String!
    rangeStep: Float
  }
  type Query {
    extendedFieldMappings(
      projectId: String!
      graphqlField: String!
      field: String
    ): [ExtendedFieldMapping]
  }

  input ExtendedFieldMappingInput {
    type: ExtendedFieldType
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: NumericTypeUnit
    displayValues: String!
    rangeStep: Float
  }

  type Mutation {
    updateExtendedMapping(
      projectId: String!
      graphqlField: String!
      field: String!
      extendedFieldMappingInput: ExtendedFieldMappingInput!
    ): ExtendedFieldMapping
  }
`;