function getIndexPrefix({ projectId, type }) {
  if (!projectId || !type || !type.index) {
    throw new Error('missing arguments');
  }

  return `arranger-projects-${projectId}-${type.index}`;
}

export default getIndexPrefix;
