import express from 'express';
import { setProject, getProject } from '../utils/projects';

export default async (req, res) => {
  let { es } = req.context;
  let { id } = req.params;

  if (!id) return res.json({ error: 'project empty' });

  id = id.toLowerCase();

  console.log(id);

  // es.search({
  //   index: ''
  // })

  res.json({ message: `hi jordan` });
};
