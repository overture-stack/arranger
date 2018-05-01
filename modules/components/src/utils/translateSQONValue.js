export default value => {
  if (value === '__missing__') {
    return 'Missing';
  }
  return value;
};
