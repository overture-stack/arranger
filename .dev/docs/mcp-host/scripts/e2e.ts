/**
 * An end-to-end chat over the whole stack: a model on Ollama, `mcp-host-core`'s loop and provider, `mcp-client`,
 * and a running `apps/mcp-server` in front of a real Arranger. Unlike the other scripts, nothing is stubbed: ES, the
 * search server and the MCP server must already be running (see the README beside this folder).
 *
 *   LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/e2e.ts --model gemma4:e4b
 *
 * Options: --base-url, --model, --mcp-url, --policy ask|allow|deny, --context <tokens>, --resume <state file>,
 * --system-prompt <file>, --full. Commands at the prompt: /pending, /tools, /save <name>, /quit. Ctrl-C cancels a
 * run, or quits when none is active. Every event is written as one JSON line under `results/e2e/`.
 *
 * Imports host-core from source, so the current branch is what runs; host-core imports `mcp-client` from its
 * `dist/`, so build that first. Not `mcp-cli chat`: just enough to watch the pieces work together.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';

import {
	APPROVAL_DECISIONS,
	type ApprovalDecision,
	EVENT_TYPES,
	type HostEvent,
	McpHost,
	OpenAiCompatibleProvider,
	renderToolResult,
} from '../../../../modules/mcp-host-core/src/index.ts';

import { assertContextLength, baseUrlFromArgs } from './ollama.ts';

const option = (name: string) => {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
};

const baseUrl = baseUrlFromArgs();
const model = option('model') ?? 'gemma4:e4b';
const mcpUrl = option('mcp-url') ?? 'http://127.0.0.1:3100/mcp';
const policy = (option('policy') ?? APPROVAL_DECISIONS.ASK) as ApprovalDecision;
const contextTokens = Number(option('context') ?? 16_384);
const resumeFrom = option('resume');
const systemPromptFile = option('system-prompt');
const full = process.argv.includes('--full');

if (!Object.values(APPROVAL_DECISIONS).includes(policy)) {
	throw new Error(`--policy must be one of ${Object.values(APPROVAL_DECISIONS).join(', ')}`);
}

const OUT = new URL('../results/e2e/', import.meta.url);
await mkdir(OUT, { recursive: true });
const logUrl = new URL(`${new Date().toISOString().replaceAll(':', '-')}.jsonl`, OUT);
const log = createWriteStream(logUrl, { flags: 'a' });

/** Server and model text, with control characters removed so it cannot drive the terminal. */
const plain = (text: string) => text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
const clip = (text: string) => (full || text.length <= 300 ? text : `${text.slice(0, 300)}… (${text.length} chars)`);

const rl = createInterface({ input: process.stdin, output: process.stdout });

// `onEvent` is synchronous, so questions are queued here and asked one at a time on the one interface.
let questions = Promise.resolve();
let run: AbortController | undefined;
const open = new Map<string, AbortController>();

const ask = (id: string, prompt: string, answer: (reply: string) => void) => {
	const own = new AbortController();
	open.set(id, own);
	const signal = run ? AbortSignal.any([run.signal, own.signal]) : own.signal;
	questions = questions.then(async () => {
		try {
			if (!signal.aborted) {
				answer((await rl.question(prompt, { signal })).trim().toLowerCase());
			}
		} catch {
			// Withdrawn or cancelled while waiting: the event already said so.
		} finally {
			open.delete(id);
		}
	});
};

const onEvent = (event: HostEvent) => {
	log.write(`${JSON.stringify(event)}\n`);
	switch (event.type) {
		case EVENT_TYPES.RUN_STARTED: {
			const servers = event.servers.map(
				({ key, trusted, containsOnlyOpenData, hash }) =>
					`${key} (trusted: ${trusted}, open data: ${containsOnlyOpenData}, hash ${hash.slice(0, 12)})`,
			);
			console.log(
				`[run_started] ${event.model.model} digest ${event.modelDigest?.slice(0, 12) ?? 'unknown'}, ` +
					`window ${event.contextWindow.tokens} configured / ${event.reportedContextWindow ?? 'unreported'} loaded, ` +
					`servers: ${servers.join(', ')}`,
			);
			return;
		}
		case EVENT_TYPES.TOKEN:
			process.stdout.write(plain(event.text));
			return;
		case EVENT_TYPES.MODEL_RESPONSE: {
			const { stopReason, usage, durationMs, reasoning } = event.response;
			console.log(
				`\n[model_response] turn ${event.turn}, ${stopReason}, ${durationMs} ms, ` +
					`tokens ${usage?.inputTokens ?? '?'} in / ${usage?.outputTokens ?? '?'} out` +
					(reasoning ? `, ${reasoning.length} chars of reasoning` : ''),
			);
			return;
		}
		case EVENT_TYPES.TOOL_CALL:
			console.log(`[tool_call] ${event.server}/${event.tool} ${clip(plain(event.arguments))}`);
			return;
		case EVENT_TYPES.APPROVAL_REQUIRED:
			console.log(`[approval_required] ${event.server}/${event.tool} ${clip(JSON.stringify(event.arguments))}`);
			ask(event.id, 'Allow this call? [y/N] ', (reply) =>
				console.log(`[respond] ${host.respond(event.id, { approve: reply === 'y' })}`),
			);
			return;
		case EVENT_TYPES.INPUT_REQUIRED:
			console.log(`[input_required] ${event.server}, round ${event.round}:\n${plain(event.message)}`);
			console.log(`requested schema: ${JSON.stringify(event.requestedSchema)}`);
			ask(event.questionId, '[a]ccept, [d]ecline or [c]ancel? ', (reply) => {
				// `{ confirm: true }` is `execute_query`'s schema, the only confirmation this server asks.
				const answer =
					reply === 'a'
						? { action: 'accept' as const, content: { confirm: true } }
						: { action: reply === 'c' ? ('cancel' as const) : ('decline' as const) };
				console.log(`[respond] ${answer.action}: ${host.respond(event.questionId, answer)}`);
			});
			return;
		case EVENT_TYPES.QUESTION_WITHDRAWN:
			console.log(`[question_withdrawn] ${event.kind} ${event.id}`);
			open.get(event.id)?.abort();
			return;
		case EVENT_TYPES.TOOL_RESULT: {
			const { outcome } = event;
			const text =
				outcome.outcome === 'result' || outcome.outcome === 'output_invalid'
					? renderToolResult(outcome.result)
					: JSON.stringify(outcome);
			console.log(`[tool_result] ${outcome.outcome}${event.isError ? ' (error)' : ''}: ${clip(plain(text))}`);
			return;
		}
		case EVENT_TYPES.DONE:
			console.log(
				`[done] ${event.reason}${event.detail ? `: ${event.detail}` : ''} ${JSON.stringify(event.totals)}`,
			);
			return;
		// Shown as they are: these are the cases worth seeing whole.
		case EVENT_TYPES.MALFORMED_TOOL_CALL:
		case EVENT_TYPES.EMPTY_REPLY:
		case EVENT_TYPES.OUTPUT_LIMIT:
		case EVENT_TYPES.CONTEXT_SHORTENED:
		case EVENT_TYPES.MODEL_ERROR:
		case EVENT_TYPES.INPUT_STATE_REJECTED:
		case EVENT_TYPES.TOOLS_CHANGED:
		case EVENT_TYPES.CONTENT_CARRIED: {
			const { type, runId, seq, at, ...rest } = event;
			console.log(`[${type}] ${clip(plain(JSON.stringify(rest)))}`);
			return;
		}
		// `model_request`, `approval_answered` and `input_answered` are in the log; `[respond]` covers the answers.
	}
};

await assertContextLength(baseUrl, model);

const host = await McpHost.create({
	servers: [{ key: 'arranger', trusted: true, connection: { url: mcpUrl } }],
	provider: new OpenAiCompatibleProvider({ baseUrl, ollama: true }),
	model: { model, temperature: 0.2, topP: 0.9, maxOutputTokens: 4_096 },
	systemPrompt: systemPromptFile ? await readFile(systemPromptFile, 'utf8') : undefined,
	approvalPolicy: () => policy,
	confirmations: {},
	limits: { turns: 20, toolCalls: 30, wallClockMs: 600_000 },
	retries: { emptyReply: true, outputLimit: true },
	contextWindow: { tokens: contextTokens, policy: 'shorten' },
	toolResultMaxChars: 50_000,
	clientInfo: { name: 'mcp-host-e2e', version: '0.0.0' },
	state: resumeFrom ? JSON.parse(await readFile(resumeFrom, 'utf8')) : undefined,
	onEvent,
	onServerError: (server, error) => console.error(`[server_error] ${server}: ${error.message}`),
});

const quit = async () => {
	rl.close();
	await host.close();
	log.end();
	console.log(`\nEvents: ${logUrl.pathname}`);
	process.exit(0);
};

rl.on('SIGINT', () => {
	if (run) {
		console.log('\n[cancelling]');
		run.abort();
	} else {
		void quit();
	}
});

console.log(`System prompt:\n${host.surface().systemPrompt}\n`);
console.log(`Approval policy: ${policy}. Events: ${logUrl.pathname}`);

while (true) {
	let line: string;
	try {
		line = (await rl.question('\nyou> ')).trim();
	} catch {
		break; // stdin closed
	}
	if (!line) {
		continue;
	}
	const [command, argument] = line.split(/\s+/, 2);
	if (command === '/quit') {
		break;
	} else if (command === '/pending') {
		console.log(JSON.stringify(host.pending(), null, 2));
	} else if (command === '/tools') {
		console.log(
			host
				.surface()
				.tools.map(({ name }) => name)
				.join('\n'),
		);
	} else if (command === '/save') {
		const file = new URL(`${argument ?? 'state'}.json`, OUT);
		await writeFile(file, JSON.stringify(host.state(), null, 2));
		console.log(`Saved: ${file.pathname}`);
	} else {
		run = new AbortController();
		try {
			await host.run({ message: line }, { signal: run.signal });
		} catch (error) {
			console.error(`[run threw] ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			run = undefined;
		}
		await questions;
	}
}
await quit();
