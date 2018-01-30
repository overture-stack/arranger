import express from 'express';

export default ({ app }) => async (req, res) => {
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  // indices must be lower cased
  id = id.toLowerCase();

  global.apps[id] = express.Router();

  global.apps[id].use(`/${id}/ping`, (req, res) => res.send('disabled'));

  global.apps[id].use(`/${id}/graphql`, (req, res) =>
    res.json({ message: `${id} graphql service has been disabled` }),
  );

  console.log(`attempted teardown of /${id}/graphql`);

  res.json({ message: `graphql server disabled` });
};
