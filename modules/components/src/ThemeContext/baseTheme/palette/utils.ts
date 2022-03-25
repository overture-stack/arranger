export interface DeepmergeOptions {
  clone?: boolean;
}

export const isPlainObject = (item: unknown): item is Record<keyof any, unknown> => {
  return item !== null && typeof item === 'object' && item.constructor === Object;
};

export const deepMerge = <Target>(target: Target, source: unknown): Target => {
  const output = { ...target };

  if (isPlainObject(target) && isPlainObject(source)) {
    Object.keys(source).forEach((key) => {
      // Avoid prototype pollution
      if (key === '__proto__') {
        return;
      }

      if (isPlainObject(source[key]) && key in target && isPlainObject(target[key])) {
        // Since `output` is a clone of `target` and we have narrowed `target` in this block we can cast to the same type.
        (output as Record<keyof any, unknown>)[key] = deepMerge(target[key], source[key]);
      } else {
        (output as Record<keyof any, unknown>)[key] = source[key];
      }
    });
  }

  return output;
};
