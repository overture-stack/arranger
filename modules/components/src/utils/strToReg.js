const escapeStrForRegex = str =>
  (str || '').replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

export default (str, { modifiers = 'i' } = {}) =>
  new RegExp(escapeStrForRegex(str), modifiers);
