import startProject from '../startProject';

export default ({ io, graphqlOptions }) => async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  try {
    startProject({ es, id, io, graphqlOptions });
  } catch (err) {
    return res.json({ error: err.message });
  }

  console.log(`graphql server running at /${id}/graphql`);
  res.json({ message: `graphql server running at /${id}/graphql` });
};
