export default (str) =>
  str
    .trim()
    .replace(' ', '_')
    .replace(/[^a-zA-Z0-9_-]/g, '-_-');
