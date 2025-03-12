import { debugLogs } from './debugging.js';

export type GenericFn = (..._arg: unknown[]) => unknown;

export const emptyArr: unknown[] = [];
export const emptyObj = {};

export const emptyArrFn = (..._arg: unknown[]): unknown[] => {
	debugLogs({ caller: 'emptyArrFn', args: _arg });
	return [];
};
export const emptyObjFn = (..._arg: unknown[]): Record<string, unknown> => {
	debugLogs({ caller: 'emptyObjFn', args: _arg });
	return {};
};
export const emptyStrFn = (..._arg: unknown[]): string => {
	debugLogs({ caller: 'emptyStrFn', args: _arg });
	return '';
};

const noopFn = (..._arg: unknown[]): void => {
	debugLogs({ caller: 'noopFn', args: _arg });
	return;
};

export default noopFn;
