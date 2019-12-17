const getTypes = async ({ id, es }) => {
  const index = `arranger-projects-${id}`;

  try {
    return (await es.search({ index })).body;
  } catch (error) {
    await es.indices.create({ index });
    return null;
  }
};

export default getTypes;
