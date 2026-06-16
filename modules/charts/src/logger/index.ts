/**
 * zero depdency, minimal logger to show extra logging if set
 */
export class Logger {
	#debugMode = false;

	setDebugMode(value) {
		this.#debugMode = value;
	}

	log(...args) {
		console.log(...args);
	}

	debug(...args) {
		if (this.#debugMode) {
			console.log(...args);
		}
	}
}

export const logger = new Logger();
