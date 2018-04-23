export default ({ str, split = [','] }) =>
  str
    ?.split(new RegExp(`[${split.join('')}]`, 'g'))
    ?.map(x => x?.trim())
    ?.filter(Boolean) || [];
