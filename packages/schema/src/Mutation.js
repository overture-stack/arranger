export let typeDefs = `
  input CreateSetInput {
    filters: JSON
    size: Int
    sort: [Sort]
    score: String
    set_id: String
  }

  input AppendSetInput {
    filters: JSON
    size: Int
    sort: [Sort]
    score: String
    set_id: String
  }

  type CreateRepositoryCaseSet {
    set_id: String
    size: Int
    time: Float
  }

  type CreateRepositoryFileSet {
    set_id: String
    size: Int
    time: Float
  }

  type AppendRepositoryCaseSet {
    set_id: String
    size: Int
    time: Float
  }

  type AppendRepositoryFileSet {
    set_id: String
    size: Int
    time: Float
  }

  type CreateSsmSet {
    set_id: String
    size: Int
    time: Float
  }

  type AppendSsmSet {
    set_id: String
    size: Int
    time: Float
  }

  type RemoveFromSsmSet {
    set_id: String
    size: Int
    time: Float
  }

  type CreateGeneSet {
    set_id: String
    size: Int
    time: Float
  }

  type AppendGeneSet {
    set_id: String
    size: Int
    time: Float
  }

  type RemoveFromGeneSet {
    set_id: String
    size: Int
    time: Float
  }

  type CreateCaseSet {
    set_id: String
    size: Int
    time: Float
  }

  type AppendCaseSet {
    set_id: String
    size: Int
    time: Float
  }

  type RemoveFromCaseSet {
    set_id: String
    size: Int
    time: Float
  }

  type RemoveFromRepositorySet {
    case(input: RemoveFromSetInput): RemoveFromCaseSet
    gene(input: RemoveFromSetInput): RemoveFromGeneSet
    ssm(input: RemoveFromSetInput): RemoveFromSsmSet
  }

  input RemoveFromSetInput {
    filters: JSON
    set_id: String
  }

  type RemoveFromSet {
    explore: RemoveFromExploreSet
    repository: RemoveFromRepositorySet
  }

  type CreateRepositorySet {
    case(input: CreateSetInput): CreateRepositoryCaseSet
    file(input: CreateSetInput): CreateRepositoryFileSet
  }

  type AppendRepositorySet {
    case(input: AppendSetInput): AppendRepositoryCaseSet
    file(input: AppendSetInput): AppendRepositoryFileSet
  }

  type AppendExploreSet {
    case(input: AppendSetInput): AppendCaseSet
    gene(input: AppendSetInput): AppendGeneSet
    ssm(input: AppendSetInput): AppendSsmSet
  }

  type AppendSet {
    explore: AppendExploreSet
    repository: AppendRepositorySet
  }

  type CreateExploreSet {
    case(input: CreateSetInput): CreateCaseSet
    gene(input: CreateSetInput): CreateGeneSet
    ssm(input: CreateSetInput): CreateSsmSet
  }

  type RemoveFromExploreSet {
    case(input: CreateSetInput): CreateCaseSet
    gene(input: CreateSetInput): CreateGeneSet
    ssm(input: CreateSetInput): CreateSsmSet
  }

  type CreateSet {
    explore: CreateExploreSet
    repository: CreateRepositorySet
  }

  type Sets {
    create: CreateSet
    append: AppendSet
    remove_from: RemoveFromSet
  }

  input RelayIsDumb {
    relay_is_dumb: JSON
  }

  type Mutation {
    sets(input: RelayIsDumb): Sets
  }
`
