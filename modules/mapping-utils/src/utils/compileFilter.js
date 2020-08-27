const isProperSqon = sqon => !!(sqon && sqon.op);

export default ({ clientSideFilter, serverSideNegativeFilter }) => ({
  op: 'and',
  content: [
    isProperSqon(clientSideFilter)
      ? clientSideFilter
      : {
          op: 'and',
          content: [],
        },
    {
      op: 'not',
      content: [
        serverSideNegativeFilter || {
          op: 'not',
          content: [],
        },
      ],
    },
  ],
});
