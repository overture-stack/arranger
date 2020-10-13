export let typeDefs = `
  enum Missing {
    first
    last
  }

  enum Mode {
    avg
    max
    min
    sum
  }

  enum Order {
    asc
    desc
  }

  input Sort {
    field: String!
    order: Order
    mode: Mode
    missing: Missing
  }
`;
