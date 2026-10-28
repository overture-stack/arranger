// A loopback stand-in for an OpenAI-compatible model server, for the provider's tests. Each test scripts the
// response, down to how the bytes are split across writes.
import { createServer, type IncomingHttpHeaders, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

/** One request the server received. */
export type ReceivedRequest = { method: string; path: string; headers: IncomingHttpHeaders; body: unknown };

/** Answers one request. */
export type ModelHandler = (request: ReceivedRequest, response: ServerResponse) => void | Promise<void>;

/** One streamed chunk, as a Chat Completions server sends it. */
export const chunk = (delta: Record<string, unknown>, finishReason?: string, extra: Record<string, unknown> = {}) =>
	JSON.stringify({
		model: 'test-model',
		choices: [{ index: 0, delta, ...(finishReason !== undefined && { finish_reason: finishReason }) }],
		...extra,
	});

/** The usage chunk sent after the last choice, when `include_usage` is set. */
export const usageChunk = (promptTokens: number, completionTokens: number) =>
	JSON.stringify({
		choices: [],
		usage: {
			prompt_tokens: promptTokens,
			completion_tokens: completionTokens,
			total_tokens: promptTokens + completionTokens,
		},
	});

/**
 * Writes an event stream.
 *
 * @param pieces - The raw text to write, each piece in its own write, so a test can split an event anywhere.
 * @param pauseMs - The pause between writes, so each arrives in its own read.
 */
export const writeStream = async (response: ServerResponse, pieces: string[], pauseMs = 5) => {
	response.writeHead(200, { 'content-type': 'text/event-stream' });
	for (const piece of pieces) {
		response.write(piece);
		await sleep(pauseMs);
	}
	response.end();
};

/** The text of a well-formed stream: one `data:` event per payload, then `[DONE]`. */
export const events = (...payloads: string[]) => [...payloads, '[DONE]'].map((data) => `data: ${data}\n\n`);

/** Starts the server on `127.0.0.1` and a free port. Its base URL ends in `/v1`, as Ollama's does. */
export const startModelServer = async () => {
	const requests: ReceivedRequest[] = [];
	let handler: ModelHandler = (_request, response) => {
		response.writeHead(404).end();
	};

	const httpServer = createServer(async (req, res) => {
		const parts: Buffer[] = [];
		for await (const part of req) {
			parts.push(part as Buffer);
		}
		const text = Buffer.concat(parts).toString('utf8');
		const request: ReceivedRequest = {
			method: req.method ?? '',
			path: req.url ?? '',
			headers: req.headers,
			body: text ? JSON.parse(text) : undefined,
		};
		requests.push(request);
		await handler(request, res);
	});
	await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
	const { port } = httpServer.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${port}/v1`,
		requests,
		/** Sets how the next requests are answered. */
		answer: (next: ModelHandler) => {
			handler = next;
		},
		close: async () => {
			httpServer.closeAllConnections();
			await new Promise<void>((resolve) => httpServer.close(() => resolve()));
		},
	};
};

export type ModelServer = Awaited<ReturnType<typeof startModelServer>>;
