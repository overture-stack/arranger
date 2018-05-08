export default (
  str,
  {
    whitelist = `\\w\\d\\s`,
    modifiers = 'i',
    blacklist = `[^${whitelist}]`,
  } = {},
) =>
  new RegExp(
    (str || '')
      .split('\\')
      .join('')
      .replace(/${blacklist}/g, ''),
    modifiers,
  );
