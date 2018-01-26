// TODO:
// this is not working.. want to "unregister" this middleware somehow

export default ({ app }) => async (req, res) => {
  let { id } = req.params;
  if (!id) return res.json({ error: 'project empty' });

  app.use(`/${id}/ping`, (req, res) => res.send('disabled'));

  app.use(`/${id}/graphql`, (req, res) =>
    res.json({ message: `${id} graphql service has been disabled` }),
  );

  res.json({ message: `graphql server disabled` });
};
