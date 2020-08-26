const isProperSqon = sqon => !!(sqon && sqon.op);

export default ({ clientSideFilter, serverSideNegativeFilter }) => {
  return {
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
  };
};
