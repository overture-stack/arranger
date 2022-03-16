/* eslint-disable @typescript-eslint/no-unused-vars */
export type GenericFn = (..._arg: any) => any;

export const emptyArrFn = (..._arg: any): never[] => [];
export const emptyObjFn = (..._arg: any): Record<string, never> => ({});
export const emptyStrFn = (..._arg: any): string => '';

const noopFn = (..._arg: any): void => {
  // do nothing
};

export default noopFn;
