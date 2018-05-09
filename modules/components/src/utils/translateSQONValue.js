export default value => {
  if (value === '__missing__') {
    return 'No Data';
  }
  return value;
};
