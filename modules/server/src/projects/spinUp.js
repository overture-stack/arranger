import startProject from '../startProject';

export default ({ graphqlOptions, enableAdmin }) => async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  try {
    startProject({ es, id, graphqlOptions, enableAdmin });
  } catch (err) {
    return res.json({ error: err.message });
  }

  res.json({ message: `graphql server running at /${id}/graphql` });
};
