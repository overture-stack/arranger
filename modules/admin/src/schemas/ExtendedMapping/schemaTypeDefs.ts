import { gql } from 'apollo-server';
import * as convert from 'convert-units';

export default async () => gql`
  scalar JSON
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
    nested
  }
  # enum NumericTypeUnit {
  #   ${convert().measures()}
  # }

  type ExtendedFieldMapping {
    gqlId: ID!
    field: String!
    type: ExtendedFieldType!
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: String
    displayValues: JSON!
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
    unit: String
    displayValues: JSON
    rangeStep: Float
  }

  input ExtendedMappingSetFieldInput {
    field: String!
    type: ExtendedFieldType
    displayName: String!
    active: Boolean!
    isArray: Boolean!
    primaryKey: Boolean!
    quickSearchEnabled: Boolean!
    unit: String
    displayValues: JSON
    rangeStep: Float
  }

  type Mutation {
    updateExtendedMapping(
      projectId: String!
      graphqlField: String!
      field: String!
      extendedFieldMappingInput: ExtendedFieldMappingInput!
    ): ExtendedFieldMapping
    saveExtendedMapping(
      projectId: String!
      graphqlField: String!
      input: [ExtendedMappingSetFieldInput]!
    ): [ExtendedFieldMapping]
  }
`;
