function getIndexPrefix({ projectId, index }) {
  if (!projectId || !index) {
    throw new Error('missing arguments');
  }

  return `arranger-projects-${projectId}-${index}`;
}

export default getIndexPrefix;
