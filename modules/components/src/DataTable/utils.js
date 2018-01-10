export function getSingleValue(data) {
  if (typeof data === 'object') {
    return getSingleValue(Object.values(data)[0]);
  } else {
    return data;
  }
}
