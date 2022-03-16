export const emptyArrFn = (): never[] => [];
export const emptyObjFn = (): Record<string, never> => ({});
export const emptyStrFn = (): string => '';

const noopFn = (): void => {
  // do nothing
};

export default noopFn;
