import { DEBUG } from '#utils/config.js';

export const debugLogs = (...args: unknown[]) => {
	DEBUG && console.log('debugLogs', ...args);
};
