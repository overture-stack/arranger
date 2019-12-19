export default es => async config => (await es.search(config)).body;
