export default (arr1, arr2, operator) => {
  const cArr1 = arr1 || [];
  const cArr2 = arr2 || [];
  return cArr1.map((x) => cArr2.find((y) => operator(x, y)) || x);
};
