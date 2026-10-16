/**
 * A minimal `/v1/chat/completions` caller over `fetch`, for the Phase 0 spikes only.
 *
 * Returns the raw HTTP status and body (or every streamed chunk) so the spikes record what the serving
 * stack sent rather than what a client library made of it. No environment variable is read here: the
 * base URL is an argument, defaulting to a local Ollama.
 */
import { readFile } from 'node:fs/promises';

export const DEFAULT_BASE_URL = 'http://localhost:11434/v1';

/** `--base-url <url>` from the command line, or the local default. */
export const baseUrlFromArgs = (argv = process.argv): string => {
	const index = argv.indexOf('--base-url');
	return index >= 0 && argv[index + 1] ? argv[index + 1] : DEFAULT_BASE_URL;
};

/** `--models a,b,c` from the command line, or the given default list. */
export const modelsFromArgs = (defaults: string[], argv = process.argv): string[] => {
	const index = argv.indexOf('--models');
	return index >= 0 && argv[index + 1] ? argv[index + 1].split(',') : defaults;
};

export const LOCAL_MODELS = ['gemma4:e4b', 'gemma4:12b', 'qwen3:14b', 'granite4.1:8b'];

export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> };

/** MCP tools as OpenAI-style function tools, with the input schema passed through unchanged. */
export const toOpenAiTools = (tools: McpTool[]) =>
	tools.map((tool) => ({
		type: 'function',
		function: { name: tool.name, description: tool.description ?? '', parameters: tool.inputSchema },
	}));

/** The real `tools/list` result captured by `s2s5.ts`. */
export const loadMcpTools = async (): Promise<McpTool[]> => {
	const raw = await readFile(new URL('../results/tools.json', import.meta.url), 'utf8');
	return (JSON.parse(raw) as { tools: McpTool[] }).tools;
};

export type ChatResponse =
	| { kind: 'json'; status: number; durationMs: number; body: unknown }
	| { kind: 'stream'; status: number; durationMs: number; chunks: unknown[]; sawDone: boolean; trailing: string };

export const chat = async (baseUrl: string, body: Record<string, unknown>): Promise<ChatResponse> => {
	const started = Date.now();
	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: 'Bearer ollama' },
		body: JSON.stringify(body),
	});

	if (!body.stream || !response.ok || !response.body) {
		const text = await response.text();
		let parsed: unknown = text;
		try {
			parsed = JSON.parse(text);
		} catch {
			// Kept as text: a non-JSON body is itself a finding.
		}
		return { kind: 'json', status: response.status, durationMs: Date.now() - started, body: parsed };
	}

	const chunks: unknown[] = [];
	let sawDone = false;
	let buffer = '';
	const decoder = new TextDecoder();
	for await (const piece of response.body) {
		buffer += decoder.decode(piece, { stream: true });
		let newline: number;
		while ((newline = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (!line.startsWith('data:')) {
				continue;
			}
			const data = line.slice('data:'.length).trim();
			if (data === '[DONE]') {
				sawDone = true;
				continue;
			}
			try {
				chunks.push(JSON.parse(data));
			} catch {
				chunks.push({ unparsed: data });
			}
		}
	}
	return {
		kind: 'stream',
		status: response.status,
		durationMs: Date.now() - started,
		chunks,
		sawDone,
		trailing: buffer,
	};
};

/** Sampling every spike request sends explicitly: Ollama's `/v1` sets omitted `temperature`/`top_p` to 1.0. */
export const greedy = { temperature: 0, top_p: 1, seed: 42 };

/**
 * Refuses to continue unless `model`, once loaded, runs with at least `minimum` tokens of context.
 *
 * Ollama's default is 4,096 and `/v1/chat/completions` cannot raise it per request, so it comes from
 * the server (`OLLAMA_CONTEXT_LENGTH`) or the model's `num_ctx`. Below it, Ollama silently drops the
 * oldest messages, and these conversations exceed 4,096 tokens after their first tool result.
 */
export const assertContextLength = async (baseUrl: string, model: string, minimum = 16_384) => {
	await chat(baseUrl, { model, messages: [{ role: 'user', content: 'Hi.' }], ...greedy, max_tokens: 1 });
	const root = baseUrl.replace(/\/v1\/?$/, '');
	const loaded = (await (await fetch(`${root}/api/ps`)).json()) as {
		models?: { name: string; context_length?: number }[];
	};
	const contextLength = loaded.models?.find(
		(entry) => entry.name === model || entry.name === `${model}:latest`,
	)?.context_length;
	if (!contextLength || contextLength < minimum) {
		throw new Error(
			`${model} is loaded with a ${contextLength ?? 'unknown'}-token context; these spikes need at least ${minimum}. ` +
				'Restart Ollama with OLLAMA_CONTEXT_LENGTH set, or use a model whose num_ctx is high enough.',
		);
	}
	return contextLength;
};
