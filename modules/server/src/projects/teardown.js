import express from 'express';
import { setProject, getProject } from '../utils/projects';

export default async (req, res) => {
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  // indices must be lower cased
  id = id.toLowerCase();

  const projectApp = express.Router();

  projectApp.use(`/${id}/ping`, (req, res) => res.send('disabled'));

  projectApp.use(`/${id}/graphql`, (req, res) =>
    res.json({ message: `${id} graphql service has been disabled` }),
  );

  setProject({ ...getProject(id), app: projectApp, id });

  console.log(`attempted teardown of /${id}/graphql`);

  res.json({ message: `graphql server disabled` });
};
