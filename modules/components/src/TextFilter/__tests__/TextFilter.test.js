import { generateNextSQON } from '../TextFilter.js';

const emptySQON = {
  op: 'and',
  content: [],
};

const sqonWithoutFilter = {
  op: 'and',
  content: [
    {
      op: 'in',
      content: {
        field: 'field1',
        value: ['one', 'two', 'three'],
      },
    },
  ],
};

const sqonWithFilter = {
  op: 'and',
  content: [
    {
      op: 'in',
      content: {
        field: 'field1',
        value: ['one', 'two', 'three'],
      },
    },
    {
      op: 'filter',
      content: {
        fields: ['field1', 'field2'],
        value: 'search value',
      },
    },
  ],
};

describe('generateNextSQON', () => {
  it('should add a filter op to sqon that does not have one', () => {
    expect(
      generateNextSQON('new value')({
        sqon: emptySQON,
        fields: ['field3', 'field4'],
      }),
    ).toEqual({
      op: 'and',
      content: [
        {
          op: 'filter',
          content: {
            fields: ['field3', 'field4'],
            value: 'new value',
          },
        },
      ],
    });
  });

  it('should remove a filter op if fields is not specified', () => {
    [null, []].forEach(fields =>
      expect(
        generateNextSQON('value')({ sqon: sqonWithFilter, fields }),
      ).toEqual(sqonWithoutFilter),
    );
  });

  it('should remove a filter op if value is not specified', () => {
    [null, ''].forEach(value =>
      expect(
        generateNextSQON(value)({
          sqon: sqonWithFilter,
          fields: ['field3, field4'],
        }),
      ).toEqual(sqonWithoutFilter),
    );
  });

  it('should replace an existing filter with a new valid one', () => {
    expect(
      generateNextSQON('another value')({
        sqon: sqonWithFilter,
        fields: ['field3', 'field4'],
      }),
    ).toEqual({
      op: 'and',
      content: [
        {
          op: 'in',
          content: {
            field: 'field1',
            value: ['one', 'two', 'three'],
          },
        },
        {
          op: 'filter',
          content: {
            fields: ['field3', 'field4'],
            value: 'another value',
          },
        },
      ],
    });
  });
});
