export const isPlural = ({
  currentPage,
  pageSize,
  total,
}: {
  currentPage: number;
  pageSize: number;
  total: number;
}) =>
  total === 0 ||
  (total > 1 &&
    pageSize > 1 &&
    (Math.ceil(total / pageSize) !== currentPage || total % pageSize > 1));
