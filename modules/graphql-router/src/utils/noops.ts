export const warnDeprecatedConfigsSource = (configsSource?: string) => {
	if (configsSource) {
		console.warn(
			'[arranger] "configsSource" is deprecated. Pass a parsed configs object instead; file parsing has moved to the server.',
		);
	}
};

/* eslint-disable @typescript-eslint/no-unused-vars */
export type GenericFn = (..._arg: any) => any;

export const emptyObj = {} as Record<string, any>;

export const emptyArrFn = (..._arg: any): never[] => [];
export const emptyObjFn = (..._arg: any): Record<string, never> => ({});
export const emptyStrFn = (..._arg: any): string => '';

const noopFn = (..._arg: any): void => {
	// do nothing
};

export default noopFn;
