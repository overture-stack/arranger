# MCP Host

Design documents for the MCP host: the stack that connects to MCP servers, runs a model through a tool-calling loop, and puts each confirmation in front of a person.

- **[`mcp-host-plan.md`](mcp-host-plan.md):** the plan, with each component, phase, decision and open question. Start here.
- **[`architecture.md`](architecture.md):** diagrams of the plan, from the system context to each request's flow.
- **[`phase0-results.md`](phase0-results.md):** what the Phase 0 spikes found, and what each changed in the plan.
- **[`model-provider-analysis.md`](model-provider-analysis.md):** why host-core has its own Chat Completions client rather than a library, and when to add the Responses API.
- **[`data-crossing-options.md`](data-crossing-options.md):** the options weighed for plan question 4, keeping each server's data out of other servers' requests unless the person flags it as open-access only, and the team's remaining choice.
- **[End-to-End Check](#end-to-end-check):** a chat through `mcp-client` and `mcp-host-core` against a running Arranger, with the scenarios that show the built phases working together.

The client's own internals are documented beside its code, in [`modules/mcp-client/docs/architecture.md`](../../../modules/mcp-client/docs/architecture.md).

## Phase 0 Spikes

Research spikes for the plan's §3 Phase 0. None of this is product code.

- **[`phase0-results.md`](phase0-results.md):** what the spikes found and what each changed in the plan. Read it before the scripts.
- **[`scripts/`](scripts):** the code behind those results, kept so the model spikes can be rerun on the development team's shared Ollama server. When the evaluation harness starts, the useful parts move into its tests.
- **`results/`:** raw output, recreated by the scripts and not committed (see the root `.gitignore`).

### Running the scripts

Run each from the repository root with `npx tsx`. They run `apps/mcp-server` in-process with Arranger stubbed, so nothing else needs to be running. `LOG_LEVEL=fatal` quiets the server's logging.

Scripts that call a model need Ollama started with `OLLAMA_CONTEXT_LENGTH=16384` or more; the default 4,096 truncates these conversations silently, and the conversation scripts refuse to run below 16,384. They take `--base-url` (default `http://localhost:11434/v1`) and `--models a,b`.

Run `s2s5.ts` first: it writes `results/tools.json`, which `s3.ts` and `s1Keywords.ts` read.

### Spike scripts

| Script                                       | Spike   | What it does                                                                                                                                                     | Time, four local models    |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`s2s5.ts`](scripts/s2s5.ts)                 | S2, S5  | Calls `execute_query` through the SDK client every way the plan considered, aborts a call in flight, and answers a confirmation on a restarted server. No model. | Seconds                    |
| [`s3.ts`](scripts/s3.ts)                     | S3      | Sends the same request streamed and not streamed, and compares the usage each reports.                                                                           | 2 minutes                  |
| [`s1Keywords.ts`](scripts/s1Keywords.ts)     | S1      | Removes each JSON Schema keyword from each tool in turn and checks whether the prompt shrinks, to find what Ollama drops.                                        | 10 minutes                 |
| [`probeContext.ts`](scripts/probeContext.ts) | Context | Checks that every message of a conversation reaches the prompt, and measures what a pretty-printed tool result costs.                                            | 3 minutes                  |
| [`runStages.ts`](scripts/runStages.ts)       | S1, S4  | Gives each model each step of eight research goals and scores the call it makes. Greedy once for S1; sampled and repeated for S4.                                | S1: 45 minutes; S4: 1 hour |
| [`summarize.ts`](scripts/summarize.ts)       | S1, S4  | Turns a `runStages.ts` run into per-model tables.                                                                                                                | Seconds                    |
| [`replayEmpty.ts`](scripts/replayEmpty.ts)   | S4      | Resends the requests that came back empty, to show the dropped calls reproduce.                                                                                  | 10 minutes                 |
| [`q5.ts`](scripts/q5.ts)                     | Q5      | Sends a model's next step twice, with and without its earlier reasoning, and compares the calls.                                                                 | 1 to 2 hours per run       |

```sh
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/s2s5.ts
npx tsx .dev/docs/mcp-host/scripts/s3.ts
npx tsx .dev/docs/mcp-host/scripts/s1Keywords.ts
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/probeContext.ts
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s1-calls
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s4 --temperature 0.7 --repeats 5 --tools build_sqon,execute_query
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/summarize.ts s4
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/replayEmpty.ts --run s4
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts --repeats 6
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts --from get_catalogue_fields --hard --repeats 6 --models qwen3:14b,gemma4:e4b
```

For the development team's shared Ollama server, reached through your own SSH tunnel ([plan §2.2](mcp-host-plan.md#llm-provider-interface)), add `--base-url http://localhost:<tunnel port>/v1` and that server's `--models`. When rerunning S4, keep Ollama's own output (`ollama serve 2>&1 | tee ollama.log`): it logs a warning when it drops a `gemma4` tool call, the confirmation Phase 0 could not get locally.

### Shared modules

Used by the scripts above; none runs on its own.

| Module                                       | Holds                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`testServer.ts`](scripts/testServer.ts)     | An in-process `apps/mcp-server` with Arranger stubbed, as `startServer` assembles it.                                                                                  |
| [`catalogue.ts`](scripts/catalogue.ts)       | The synthetic two-catalogue Arranger the model spikes query, so tool results hold no dataset records.                                                                  |
| [`goals.ts`](scripts/goals.ts)               | The eight research goals and the reference call for each step.                                                                                                         |
| [`conversation.ts`](scripts/conversation.ts) | Builds each step's conversation from real tool results, and scores a model's call: does it parse, is it the right tool, is it schema-valid, does the server accept it. |
| [`ollama.ts`](scripts/ollama.ts)             | A minimal `/v1/chat/completions` client over `fetch`, the command-line options, and the context-window check.                                                          |

## End-to-End Check

[`scripts/e2e.ts`](scripts/e2e.ts) checks the components Phases 1 and 2 built, working together: a model on Ollama, `mcp-host-core`'s loop and provider, `mcp-client`, and a running `apps/mcp-server` in front of a real Arranger. Nothing is stubbed. It is an interactive chat, not a test suite, since a real model's replies need a person to judge them. `mcp-cli chat` (plan §3, Phase 3) replaces it.

It sits in `scripts/` because it reuses `ollama.ts`'s options and context-window check. Its output goes to `results/e2e/`, which is not committed.

### Running the check

1. Start ES, the search server and the MCP server as [`apps/mcp-server/README.md`](../../../apps/mcp-server/README.md#local-arranger) § Local Arranger describes. Start the MCP server with `MCP_HOST=127.0.0.1`, since a loopback bind needs no secret.
2. Start Ollama with `OLLAMA_CONTEXT_LENGTH=16384` or more. The script refuses to run below that.
3. Build `mcp-client`, which host-core imports from its `dist/`. Host-core itself is imported from source, so the current branch is what runs.

```sh
npm run build -w modules/mcp-client
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/e2e.ts --model gemma4:e4b
```

| Option                   | Default                     | Does                                                                                          |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| `--base-url`             | `http://localhost:11434/v1` | The model server.                                                                             |
| `--model`                | `gemma4:e4b`                | The model.                                                                                    |
| `--mcp-url`              | `http://127.0.0.1:3100/mcp` | The MCP server.                                                                               |
| `--policy`               | `ask`                       | The approval policy: `ask`, `allow` or `deny`.                                                |
| `--context`              | `16384`                     | The context window host-core plans for. The smaller of it and Ollama's loaded window is used. |
| `--system-prompt <file>` | None                        | A system prompt, sent before the server's instructions.                                       |
| `--resume <file>`        | None                        | A state saved with `/save`, to continue that conversation.                                    |
| `--full`                 | Off                         | Prints tool results in full, rather than their first 300 characters.                          |

At the prompt, `/pending` lists open questions, `/tools` lists the model's tools, `/save <name>` saves the conversation's state and `/quit` quits. Ctrl-C cancels a run, or quits when no run is active.

### Scenarios

| #   | Do                                                                                                                                                                                                   | Expect                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Start the script                                                                                                                                                                                     | `run_started` lists `arranger` as trusted, with a hash, and a loaded window, which shows Ollama's native API was reached. `/tools` lists the `mcp__arranger__*` tools.                                                                                                                                 |
| 2   | Ask which catalogues and fields are available                                                                                                                                                        | Read-only calls, each asked about under `--policy ask`, and field names from the seeded index. The run ends `answered`.                                                                                                                                                                                |
| 3   | Ask how many files there are, approve each call and accept the confirmation                                                                                                                          | `execute_query`'s confirmation shows the GraphQL query, then the result holds the count the search server itself reports.                                                                                                                                                                              |
| 4   | The same, declining the confirmation                                                                                                                                                                 | The model is told the query was declined and answers without data. Not met yet: see the tech-debt entry on a declined `execute_query`.                                                                                                                                                                 |
| 5   | The same, denying an approval                                                                                                                                                                        | The call never reaches the server, and the model is told it was refused.                                                                                                                                                                                                                               |
| 6   | Ctrl-C while a confirmation is open                                                                                                                                                                  | `question_withdrawn`, then `done` with `cancelled`. The next message continues the conversation.                                                                                                                                                                                                       |
| 7   | Ask a follow-up to an earlier answer                                                                                                                                                                 | The model uses the earlier turns.                                                                                                                                                                                                                                                                      |
| 8   | `/save <name>`, quit, and restart with `--resume` and the `.json` path `/save` printed, not the `.jsonl` event log                                                                                   | The conversation continues. A confirmation still open when it was saved gets the "abandoned" tool message.                                                                                                                                                                                             |
| 9   | Restart with `--context 4096` and ask anything                                                                                                                                                       | `done` with `context_window` after 0 turns, and nothing is sent to the model. Every request reserves the script's 4,096-token reply cap on top of the system prompt and tools, so it cannot fit, and on the first turn there is no older tool result to shorten.                                       |
| 10  | Restart with `--context 11000`, ask scenario 3's question, then a follow-up that makes the model read the fields again, such as "Look up the fields again and tell me which ones describe file type" | `context_shortened` on the follow-up, naming the first `get_catalogue_fields` result, and the run still completes. Only older tool results are shortened, never the latest turn's. The window that triggers it depends on the model's token counts, so it may take a try or two either side of 11,000. |
| 11  | Restart with `--policy allow`                                                                                                                                                                        | No approval prompts. The confirmation is still asked, since the server asks it.                                                                                                                                                                                                                        |
| 12  | Restart with `--system-prompt <file>`                                                                                                                                                                | The printed system prompt shows the file's text, then the server's instructions under their heading.                                                                                                                                                                                                   |

A scenario that fails on `gemma4:e4b` is worth rerunning on `qwen3:14b` before treating it as a defect in the stack. Ollama drops some `gemma4` tool calls, which shows up here as `empty_reply` and its retry.
