import flattenMapping from '../flattenMapping';

const testMapping = {
  level_1_1: {
    type: 'nested',
    properties: {
      level_2_1: {
        type: 'keyword',
      },
      level_2_2: {
        type: 'nested',
        properties: {
          level_3_1: {
            type: 'keyword',
          },
          level_3_2: {
            type: 'keyword',
          },
        },
      },
      level_2_3: {
        type: 'long',
      },
      level_2_4: {
        type: 'keyword',
      },
    },
  },
  level_1_2: {
    properties: {
      level_2_1: {
        type: 'keyword',
      },
      level_2_2: {
        properties: {
          level_3_1: {
            type: 'keyword',
          },
          level_3_2: {
            type: 'keyword',
          },
        },
      },
      level_2_3: {
        type: 'long',
      },
      level_2_4: {
        type: 'keyword',
      },
    },
  },
};

const expectedOutput = [
  { fieldName: 'level_1_1', type: 'nested' },
  { fieldName: 'level_1_1.level_2_1', type: 'keyword' },
  { fieldName: 'level_1_1.level_2_2', type: 'nested' },
  { fieldName: 'level_1_1.level_2_2.level_3_1', type: 'keyword' },
  { fieldName: 'level_1_1.level_2_2.level_3_2', type: 'keyword' },
  { fieldName: 'level_1_1.level_2_3', type: 'long' },
  { fieldName: 'level_1_1.level_2_4', type: 'keyword' },

  { fieldName: 'level_1_2', type: 'object' },
  { fieldName: 'level_1_2.level_2_1', type: 'keyword' },
  { fieldName: 'level_1_2.level_2_2', type: 'object' },
  { fieldName: 'level_1_2.level_2_2.level_3_1', type: 'keyword' },
  { fieldName: 'level_1_2.level_2_2.level_3_2', type: 'keyword' },
  { fieldName: 'level_1_2.level_2_3', type: 'long' },
  { fieldName: 'level_1_2.level_2_4', type: 'keyword' },
];

test('flattenMapping', () => {
  let actualOutput = flattenMapping(testMapping);
  expect(actualOutput).toEqual(expectedOutput);
});
