export const emptyArrFn = (): never[] => [];
export const emptyObjFn = (): Record<string, never> => ({});

const noopFn = (): void => {
  // do nothing
};

export default noopFn;
