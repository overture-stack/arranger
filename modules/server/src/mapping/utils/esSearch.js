export default (es) => {
  const output = async (params) => (await es.search(params)).body;
  return output;
};
