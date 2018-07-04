export default ({ sqon = null, nestedFields }) =>
  (sqon?.content || [])
    .filter(({ content }) => {
      const splitted = content?.field?.split('.') || '';
      return content?.field && splitted.length
        ? nestedFields.includes(
            splitted.slice(0, splitted.length - 1).join('.'),
          )
        : false;
    })
    .reduce((acc, filter) => {
      const splitted = filter.content.field.split('.');
      const parentPath = splitted.slice(0, splitted.length - 1).join('.');
      return {
        ...acc,
        [parentPath]: [...(acc[parentPath] || []), filter],
      };
    }, {});
