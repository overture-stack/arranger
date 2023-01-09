/** Makes all properties optional recursively including nested objects.
 *
 * Bear in mind that this should be used on json / plain objects only;
 * otherwise, it will make class methods optional as well.
 */
export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer I>
    ? Array<RecursivePartial<I>>
    : RecursivePartial<T[P]>;
};

// TODO: enhance this to take a list of prefixes
export type PrefixKeys<T, Prefix extends string> = {
  [P in keyof T as `${Prefix}${Capitalize<string & P>}`]: T[P];
};

export type WithFunctionOptions<T, Input = T> = {
  [key in keyof T]: T[key] | ((input: Input) => T[key]);
};
