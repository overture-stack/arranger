export default (str, { whitelist = `[^\\w\\d\\s]`, modifiers = 'i' } = {}) =>
  new RegExp(
    (str || '')
      .split('\\')
      .join('')
      .replace(/${whitelist}/g, ''),
    modifiers,
  );
