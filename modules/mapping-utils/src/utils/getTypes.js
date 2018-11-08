export default async ({ id, es }) => {
  const index = `arranger-projects-${id}`;

  try {
    return await es.search({ index, type: index });
  } catch (error) {
    await es.indices.create({ index });
    return null;
  }
};
