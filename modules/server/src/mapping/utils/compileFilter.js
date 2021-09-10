const isProperSqon = (sqon) => !!(sqon && sqon.op);

export default ({ clientSideFilter, serverSideFilter }) => ({
  op: 'and',
  content: [
    isProperSqon(clientSideFilter)
      ? clientSideFilter
      : {
          op: 'and',
          content: [],
        },
    serverSideFilter || {
      op: 'and',
      content: [],
    },
  ],
});
