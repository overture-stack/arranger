// A provider that replays scripted replies, for this module's tests. It records every request it is sent.
import {
	type FinalResponse,
	type LlmProvider,
	type ModelError,
	type ProviderMalformedCall,
	type ProviderRequest,
	type ProviderStreamItem,
	type ProviderToolCall,
} from '../provider.js';

/** One scripted reply. */
export type ScriptStep = {
	/** Streamed before the response. */
	deltas?: string[];
	response?: Partial<FinalResponse>;
	error?: ModelError;
	/** Waits until the request is aborted, then reports `aborted`. */
	hang?: boolean;
	/** Ends the stream with no response and no error. */
	endEarly?: boolean;
	/** Throws instead of yielding, as a broken provider would. */
	throws?: string;
};

/** A text reply. */
export const say = (text: string, response: Partial<FinalResponse> = {}): ScriptStep => ({
	response: { text, stopReason: 'stop', ...response },
});

/** A well-formed call, with its arguments serialized as a model sends them. */
export const call = (name: string, args: unknown = {}, id?: string): ProviderToolCall => ({
	kind: 'call',
	name,
	arguments: typeof args === 'string' ? args : JSON.stringify(args),
	...(id !== undefined && { id }),
});

/** A call the provider could not parse. */
export const malformed = (raw: string, name?: string): ProviderMalformedCall => ({
	kind: 'malformed',
	raw,
	...(name !== undefined && { name }),
});

/** A reply that makes tool calls. */
export const calls = (...toolCalls: (ProviderToolCall | ProviderMalformedCall)[]): ScriptStep => ({
	response: { text: '', toolCalls, stopReason: 'tool_calls' },
});

const complete = (response: Partial<FinalResponse>): FinalResponse => ({
	text: '',
	toolCalls: [],
	stopReason: 'stop',
	durationMs: 1,
	...response,
});

/** Replays steps in order; a request past the last step gets an error. */
export class ScriptedProvider implements LlmProvider {
	readonly url = 'http://scripted.test/v1';
	/** Every request, copied when sent. */
	readonly requests: ProviderRequest[] = [];
	readonly #steps: ScriptStep[];
	readonly #digest: string | undefined;
	readonly #contextWindow: number | undefined;

	constructor(
		steps: ScriptStep[],
		options: { digest?: string; contextWindow?: number; reduceReasoning?: boolean } = {},
	) {
		this.#steps = [...steps];
		this.#digest = options.digest;
		this.#contextWindow = options.contextWindow;
		if (options.reduceReasoning) {
			this.reduceReasoning = (request) => ({ ...request, extra: { ...request.extra, reasoning_effort: 'low' } });
		}
	}

	reduceReasoning?: (request: ProviderRequest) => ProviderRequest;

	async modelDigest(): Promise<string | undefined> {
		return this.#digest;
	}

	async contextWindow(): Promise<number | undefined> {
		return this.#contextWindow;
	}

	/** Steps not yet used. */
	get remaining(): number {
		return this.#steps.length;
	}

	async *generate(request: ProviderRequest, signal: AbortSignal): AsyncIterable<ProviderStreamItem> {
		this.requests.push(structuredClone(request));
		const step = this.#steps.shift();
		if (!step) {
			yield { type: 'error', error: { kind: 'unknown', message: 'The script has no more steps' } };
			return;
		}
		if (step.throws !== undefined) {
			throw new Error(step.throws);
		}
		for (const text of step.deltas ?? []) {
			yield { type: 'delta', text };
		}
		if (step.hang) {
			await new Promise<void>((resolve) => {
				if (signal.aborted) {
					resolve();
				}
				signal.addEventListener('abort', () => resolve(), { once: true });
			});
			yield { type: 'error', error: { kind: 'aborted', message: 'aborted' } };
			return;
		}
		if (step.endEarly) {
			return;
		}
		if (step.error) {
			yield { type: 'error', error: step.error };
			return;
		}
		yield { type: 'response', response: complete(step.response ?? {}) };
	}
}
