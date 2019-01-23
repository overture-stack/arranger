import React from 'react';

export default ({ sqon }) => {
  return <pre>{JSON.stringify(sqon, null, 1)}</pre>;
};
