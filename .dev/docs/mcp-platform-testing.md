# MCP Server Platform Testing: Plan

**Status:** plan only. Nothing here is implemented. Last updated 2026-08-23.

**Goal:** a fixed harness, fixed dataset, and a pinned model configuration, run against a changing `apps/mcp-server`, producing numbers that justify a decision to keep or revert a change.

---

## 0. Environment assumptions

These are the constraints the rest of the document is built on.

- **Models are open-weight, served from hardware the team controls**, in small, medium, and large tiers. Sampling parameters (temperature, top-p, seed) are configurable, and **the client is ours too, so sampling is fixed at greedy**: temperature 0, one fixed seed, everywhere. Query translation has one right answer, so sampling would add variance with no upside.
- **Data lives on a separate testing ES instance and Arranger server**, not in the repo. The dataset is real, not synthetic, and it is **frozen**: it is not reindexed or mutated between runs.
- **The MCP server may be local, or a separately deployed instance.** The suite must support both, selected by configuration.
- **Everything is env-var configurable**: Arranger endpoint, MCP endpoint, model endpoint, model identity, sampling config, which intents run all their phrasings.

Two consequences shape most of what follows: greedy sampling makes runs near-repeatable but never bit-exact, and the dataset is frozen but not _owned_ by the suite, so the suite verifies the freeze cheaply rather than enforcing it.

**Terminology**

- **Dataset**: the documents in the testing indices (`concepts.md` already uses "dataset" in this plain sense).
- **Test environment**: the dataset _and_ the catalogue configuration together, which is the scope the fingerprint covers, since either one changing invalidates a baseline identically.
- **Case set**: the test cases and their expectations.
- **Intent** and **phrasing**: an intent is one thing a researcher wants to know; a phrasing is one way of asking for it. A case is an intent plus several phrasings of it, all sharing the same expected outcome.
- **Fixtures** is reserved for small, committed, suite-controlled data files, matching existing repo usage.
- **temperature**: controls how creative or predictable a model's output is, where 0 is the most predictable.
- **top-p**: controls how many candidates the model may pick from at each step, where lower values confine it to the most likely few.
- **seed**: the starting point for the model's random picks, so repeating a request with the same seed returns the same answer.

---

## 1. Overview

### 1.1 The approach

**Freeze everything** except the MCP server. Point the harness at the testing Arranger and the model server, and fingerprint the test environment so a silent reindex or configuration change cannot invalidate results. Open a real MCP client session and drive the model through a real tool-calling loop.

Record the **full trajectory** of every run: which tools were called with which arguments, what the server returned, how many tokens each turn consumed, how long the server itself took, and what the model finally said.

Score with **deterministic** checks first and a model judge only where prose quality is the thing being measured.

Ask every intent **several ways**. Sampling is greedy, so asking the same words twice tells you almost nothing new; asking the same question in different words tells you whether the server holds up against how researchers actually talk.

Append every result to a results file, one JSON record per run, next to a **run manifest** that records exactly what was held fixed. To judge a change, compare the new run against a saved earlier one, case by case, reporting each metric's difference along with a range that says whether that difference is real or just noise.

### 1.2 Greedy sampling and measurements

Every run uses the same configuration: temperature 0, one fixed seed, an explicitly pinned context length, and concurrency 1. That eliminates sampling variance, making one run per phrasing enough, and every run directly comparable to each other.

This configuration changes where the interesting variance lives. Running the same words twice returns nearly the same trajectory, so repeated identical sessions buy almost nothing. **Running the same intent _phrased differently_ is the test that matters**, because real researchers do not ask the same thing: one asks for "kidney cancer patients over 60", the next asks for "patients aged 60+ with renal carcinoma", and a portal that answers those differently is not trustworthy. One set of runs therefore supports two readings:

| Reading                     | Question it answers | Why it matters                                                                     | Metrics                                                                              |
| --------------------------- | ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Mean** across phrasings   | Is it better?       | Whether the change moved capability at all                                         | `outcomeMatch`, `responseTypeMatch` ([§3.1](#31-measuring-correctness-and-workflow)) |
| **Spread** across phrasings | Is it trustworthy?  | A researcher who rewords a question and gets a different count cannot trust either | `paraphraseRobustness`, `answerDispersion` ([§3.3](#33-measuring-consistency))       |

### 1.3 Three layers, not one suite

Most of what the team wants to know does not need a model, and the parts that do are slower and noisier. Separating them is the most important structural decision here.

| Layer            | What it tests                                                                                                                     | Model involved | Runs                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------- |
| **L1: contract** | Tool schemas, output shapes, error messages, validation rejections, elicitation round trip, static token cost of the tool surface | No             | Every PR, gates CI                             |
| **L2: agent**    | Whether a model given a natural-language goal reaches the right answer through the right tools                                    | Yes            | On demand, nightly, pre-release                |
| **L3: judge**    | Whether the final natural-language answer is faithful, complete, and correctly abstains                                           | Yes (grader)   | Offline, replayable from stored L2 transcripts |

L1 is where most regressions will actually be caught, because most changes to this server are changes to schemas, descriptions, validation, and error text. L2 answers "did the model behave better". L3 is replayable: because L2 stores full transcripts, the judge can be re-run without re-running the agent loop, so a rubric can be revised and everything re-scored without going near the model server.

**Only L1 metrics may fail a build.** L2 and L3 carry real variance, so a hard gate on them produces false failures, and a gate that cries wolf gets disabled within a fortnight, leaving no gate at all. L2 and L3 report; L1 gates. This is the reason the layers are split.

`integration-tests/mcp-server` today is already a partial L1. This plan extends that pattern rather than replacing it, but the eval suite points at external services rather than starting ES itself.

---

## 2. What is being pinned

Everything here goes into a **run manifest** written alongside every results file. Two runs are only comparable if their manifests differ in exactly the dimension being studied, so the comparison CLI warns loudly when they differ anywhere else.

**Test environment and case set.** The fingerprint covers the dataset and the catalogue configuration together, because either one changing invalidates a baseline the same way: per index, the document count, the mapping hash, and a checksum over a fixed aggregation, plus the `/introspection` output hashed. All of it obtained through Arranger, never ES ([§4.1](#41-working-against-the-frozen-dataset)). The case set is hashed separately.

**Model and serving stack.**

- Serving engine and version (Ollama is the likely choice; vLLM, SGLang, TGI, and llama.cpp are the alternatives).
- Model repo plus revision, never a friendly name, and the quantization scheme and precision. Two servings of "the same" model at different quantization are different models here. This also fixes the tokenizer, which every token metric depends on ([§3.4](#34-measuring-tokens-and-time)).
- Chat template, tool-call parser, and structured-output backend, including whether it was enabled for tool arguments.
- Served context length, max output tokens, and any prompt-truncation policy.
- Sampling and determinism: temperature, top-p, top-k, repetition penalty, seed policy, the concurrency the run executed at, and any engine batch-invariance mode.

**MCP surface and build.**

- **The surface hash**: the `initialize` instructions plus the serialized `tools/list`, `resources/list`, and `prompts/list`. This is the thing under test, so its hash is the change identifier.
- Mode, and the build identity that comes with it: local mode gives the git SHA of `apps/mcp-server` plus hashes of every rebuilt `modules/*`; remote mode gives whatever version the server reports ([§5.4.1](#541-local-versus-remote-mcp-server)).

**Harness.**

- MCP client name and version, declared capabilities (notably whether `elicitation` is advertised), elicitation response policy, per-call timeout, tool-call and turn budgets.
- Judge model identity and judge prompt hash.

**Not pinned:** model output. Greedy decoding narrows it sharply but does not make it bit-exact ([§1.2](#12-greedy-sampling-and-measurements)), so it is still treated as a variable to be measured rather than a constant to be relied on.

---

## 3. Metrics

Every metric below is reported **per model tier**. Token metrics are tokenizer-relative, so they are never summed across tiers.

`Kind` says how a value is produced: _deterministic_ (computed from the trajectory, no model needed), _recorded_ (observed, no pass or fail), _aggregate_ (computed across the phrasings of one intent rather than per run), or _judged_. `Gate` says what a metric is allowed to do.

**★ marks the metrics in each group that carry the decision**, seven in total across the five groups. The unmarked ones are there to explain a movement in a starred metric, or to stop one being misread.

**Did it get the right answer?**

| Metric                | Answers                                                 | Layer | Kind          | Gate   | §   |
| --------------------- | ------------------------------------------------------- | ----- | ------------- | ------ | --- |
| ★ `outcomeMatch`      | Exact total, primary-key set, and buckets               | L2    | Deterministic | Report | 3.1 |
| ★ `responseTypeMatch` | Answers, declines, asks, or chats, as the case requires | L2    | Deterministic | Report | 3.1 |
| `sqonEquivalence`     | Was the filter semantically one of the acceptable SQONs | L2    | Deterministic | Report | 3.1 |
| `answerQuality`       | Is the final prose faithful, complete, correctly worded | L3    | Judged        | Report | 3.1 |

`outcomeMatch` is the strongest single signal in the suite, and `responseTypeMatch` is starred beside it because it guards the one failure the rest of the group cannot see: without the negative categories, a server that makes the model query for everything scores well. `sqonEquivalence` is diagnostic, and matters because on a bounded dataset a wrong filter can still return the right count.

**Can we rely on it?**

| Metric                   | Answers                                                       | Layer | Kind          | Gate        | §   |
| ------------------------ | ------------------------------------------------------------- | ----- | ------------- | ----------- | --- |
| ★ `paraphraseRobustness` | Do all phrasings of one intent succeed                        | L2    | Aggregate     | Report      | 3.3 |
| ★ `answerDispersion`     | Reworded question, same number? (distinct count, modal share) | L2    | Aggregate     | Report      | 3.3 |
| `surfaceStability`       | Do fresh sessions start byte-identical                        | L1    | Deterministic | **CI gate** | 3.3 |

`paraphraseRobustness` tells us if we get the correct answer for each provided phrasing of the question: a researcher can only rely on an answer that survives being asked differently. `answerDispersion` catches what it cannot, where every phrasing succeeds by its own lights but reports a different number.

**Did it follow the intended workflow?**

| Metric                 | Answers                                                 | Layer | Kind          | Gate   | §   |
| ---------------------- | ------------------------------------------------------- | ----- | ------------- | ------ | --- |
| ★ `forbiddenPatterns`  | Did it guess a catalogue, a field, or a raw SQON        | L2    | Deterministic | Report | 3.1 |
| `requiredToolsPresent` | Did it call the tools the task needed (set containment) | L2    | Deterministic | Report | 3.1 |

Only one is starred here, because `requiredToolsPresent` is largely implied by `outcomeMatch`: a case rarely produces the right structured result without the tools that fetch it. `forbiddenPatterns` catches what that misses, the model that guessed and happened to be right, and it is the direct measurement of whether the "Never guess" rules work.

**Does the surface communicate?**

| Metric                  | Answers                                                  | Layer | Kind          | Gate                    | §   |
| ----------------------- | -------------------------------------------------------- | ----- | ------------- | ----------------------- | --- |
| ★ `semanticallyInvalid` | Does introspection convey the domain (fields, operators) | L2    | Deterministic | Report                  | 3.2 |
| `errorRecoveryWithinK`  | Are the error messages actionable                        | L2    | Deterministic | Report                  | 3.2 |
| `schemaInvalid`         | Do the input schemas and descriptions communicate        | L2    | Deterministic | Report                  | 3.2 |
| `tierCrossover`         | Smallest model tier that passes the case reliably        | L2    | Aggregate     | Report                  | 3.3 |
| `parseFailures`         | Guard: could the serving stack emit a well-formed call   | L2    | Deterministic | **Invalidates the run** | 3.2 |

`semanticallyInvalid` is how often the model was told enough to build a valid call and still did not, and `errorRecoveryWithinK` is the one to watch beside it whenever error text changes. `tierCrossover` is the same question asked across model tiers; it is deferred rather than dropped, since multi-tier comparison is not a starting priority.

**What does it consume?**

| Metric                       | Answers                                                   | Layer | Kind          | Gate                 | §   |
| ---------------------------- | --------------------------------------------------------- | ----- | ------------- | -------------------- | --- |
| ★ `staticSurfaceTokens`      | Context consumed by every session before it starts        | L1    | Deterministic | **CI gate (budget)** | 3.4 |
| `turnCount`, `toolCallCount` | Efficiency, unconfounded by hardware or load              | L2    | Deterministic | Report               | 3.4 |
| `contextFraction`            | Does the surface even fit the small tier's window         | L2    | Recorded      | Report               | 3.4 |
| `runTokens`                  | Total consumption per task (cache-independent figure)     | L2    | Recorded      | Report               | 3.4 |
| `toolResultTokens`           | Which tool responses are fat (p50, max per tool)          | L2    | Recorded      | Report               | 3.4 |
| `serverLatency`              | Time attributable to MCP plus Arranger plus ES (p50, p95) | L2    | Recorded      | Report, never gate   | 3.4 |

`staticSurfaceTokens` is the only number here free of both model and hardware variance, which is why it is also the only one that gates CI. Among the rest, prefer `turnCount` over `serverLatency`: it is the efficiency measure shared GPUs cannot distort.

### 3.1 Measuring correctness and workflow

This covers the "Did it get the right answer?" and "Did it follow the intended workflow?" groups, which share one piece of instrumentation. The MCP client sees every `tools/call`, so wrapping `client.callTool` to record `{ name, arguments, startedAt, durationMs, isError, resultTokens }` produces the whole trajectory, and every workflow metric is a query over that list.

- **★ `outcomeMatch`** asserts on the _structured_ result of the final `execute_query`, never the model's prose: exact `total`, exact set of returned primary keys, exact aggregation buckets. The frozen dataset makes these exact and the fingerprint check ([§4.1](#41-working-against-the-frozen-dataset)) licenses the exactness. The strongest single signal in the suite.
- **`sqonEquivalence`** compares the SQON that reached `execute_query` against the case's set of acceptable SQONs, normalized semantically (clause ordering, root wrapper, value arrays) rather than compared as strings. `modules/sqon` already owns the normalization primitives. Worth having separately from `outcomeMatch` because on a bounded dataset a wrong filter can return the right count.
- **★ `responseTypeMatch`** checks that the model took the right _kind_ of action for the case, which is not the same question as whether it got the right answer. It exists for two reasons. First, it is the only guard against a degenerate optimum: if every case were answerable, the top-scoring server would be the one that pushes the model to always query. Second, it is the only test of behaviour the server already ships instructions for. [instructions.ts](../../apps/mcp-server/src/mcp/instructions.ts) tells the model to ask which was meant rather than silently choosing, and to say so when no field holds the data; [prompts.ts](../../apps/mcp-server/src/mcp/prompts.ts) goes further and specifies exact output formats for the Unanswerable, Ambiguous, and Improper cases. Nothing currently tests whether any of that works.

    | Case category    | Deterministic expectation                                       | Reads prose?       |
    | ---------------- | --------------------------------------------------------------- | ------------------ |
    | **Answerable**   | `execute_query` ran, and `outcomeMatch` holds                   | No                 |
    | **Unanswerable** | No `execute_query` at all                                       | No                 |
    | **Ambiguous**    | No `execute_query`, and the final turn asks the user a question | One weak heuristic |
    | **Improper**     | No tool calls whatsoever, not even `list_catalogues`            | No                 |

- **`requiredToolsPresent`** checks that the required set is a subset of the called set. Containment, never sequence equality.
- **★ `forbiddenPatterns`** is a named list of things that must not happen: `execute_query` before any `get_catalogue_fields` for that catalogue, a `catalogueId` outside the configured list, a `fieldName` that does not exist in the catalogue, a SQON reaching `execute_query` that never came out of `build_sqon`. These map one-to-one onto the "Never guess" rules in [instructions.ts](../../apps/mcp-server/src/mcp/instructions.ts), which makes them a direct measurement of whether those instructions work.
- **`answerQuality`** is the one judged metric, scored by a rubric over stored transcripts. **Deferred until R4 ([§7](#7-implementation-plan)) shows the judge agrees with hand labels**; if it does not, this metric is dropped rather than trusted.

### 3.2 Measuring rejections and recovery

A rejected tool call is the highest-signal event the suite observes, and it needs no judge. The critical part is that **three different failures produce a rejection, and only two of them say anything about the MCP server.** They are told apart by where the call failed:

- **`parseFailures`** covers calls that never formed at all: malformed JSON, a wrong wrapper, or a call emitted as prose. It is a **guard, not a quality metric**, because a chat template or tool-call parser mismatch produces exactly this while looking nothing like its own cause. A spike invalidates the run rather than condemning the server.
- **`schemaInvalid`** is a well-formed call rejected by the tool's input schema.
- **★ `semanticallyInvalid`** is a schema-valid call rejected by the server's own domain validation: unknown fields, operators not valid for a field type, catalogue mismatches, an invalid `existingSqon`.
- **`errorRecoveryWithinK`** pairs each rejection with the calls that follow it: recovered in 1, recovered in 2 to k, or never recovered. This is the only measure of error _message_ quality. Expect it to be strongly tier-dependent: recovery is where small models fall apart, and where good error text pays off most.

### 3.3 Measuring consistency

These are computed across the _phrasings_ of one intent:

- **★ `paraphraseRobustness`**: the share of intents where every phrasing succeeded. **A run succeeds when `responseTypeMatch` holds**, which for an answerable case means `execute_query` ran and `outcomeMatch` holds, and for the three negative categories means the model correctly declined, asked, or stayed conversational ([§3.1](#31-measuring-correctness-and-workflow)). Report the failing phrasing alongside the score, since which wording broke is the actionable part.
- **★ `answerDispersion`**: the count of _distinct_ answers across an intent's phrasings, plus the most frequent answer's share. **Compute it over the structured answer, not the prose**: the final `execute_query` result, the chosen catalogue, and the set of filtered field names. That keeps it deterministic. This is the metric that catches the worst failure mode for a data portal, where two wordings of one question both look answered and return different counts.
- **`tierCrossover`**: the smallest tier where an intent's `paraphraseRobustness` clears a threshold.
- **`surfaceStability`**: open M sessions against the same server and assert the surface hash is identical across all of them. It catches accidental nondeterminism in the session prefix: a timestamp, a Map iteration order, a live call where a static string was intended.

**One caveat that is not the model's fault.** Elasticsearch does not guarantee a stable order for documents with equal sort keys unless a tiebreaker is specified. Outcome assertions compare the _set_ of primary keys, so they are safe, but a case asserting "the top hit is X" would flake for reasons unrelated to anything under test. Add a tiebreaker or avoid ordinal assertions.

### 3.4 Measuring tokens and time

**Tokens** come from the serving stack: `prompt_tokens` and `completion_tokens` on each response, and a tokenize endpoint for text the model has not been sent yet. Ollama exposes `/api/tokenize`, as does vLLM at `/tokenize`; where an engine has no such endpoint, load the model's tokenizer locally, pinned to the same revision.

- **★ `staticSurfaceTokens`**: tokenize the `initialize` instructions plus the serialized tool schemas. No generation, no variance, so this is the CI budget gate.
- **`contextFraction`**: the same figures from `staticSurfaceTokens` as a share of the served context window. A `get_catalogue_fields` response on a wide catalogue is a rounding error for a large model and a third of a small model's window, and only the fraction makes that visible.
- **`runTokens`**: `prompt_tokens` plus `completion_tokens` across turns. With prefix caching on, the prompt-token figure may or may not reflect cache reuse depending on the engine, so record the engine's cache statistics and report a cache-independent figure.
- **`toolResultTokens`**: p50 and max per tool. This is where `execute_query` result compaction and `get_catalogue_fields` verbosity show up.

**Time** is reported for a general sense of performance and never gated, because the hardware is shared and load-dependent. Three controls make it worth recording at all:

- **Fix concurrency** (default 1) and record it. A run at concurrency 8 is not comparable to one at concurrency 1, and neither is comparable to one where someone else was using the GPUs.
- **Record serving-side load**: queue depth or GPU utilization where the engine exposes them, snapshotted at run start and end, plus any batch-invariance mode in use. Timings are comparable as long as concurrency is pinned, with one exception: an engine's batch-invariance mode trades throughput for reproducibility, so timings from a run using it are not comparable to timings from one that is not ([§1.2](#12-greedy-sampling-and-measurements)).
- **Separate `serverLatency` from model time.** `serverLatency` is the sum and per-tool p50/p95 of `tools/call` round-trip duration, including the Arranger round trip and ES time, and it is the only part the team can act on. Model time is wall clock minus that, and belongs in the manifest as serving-config context rather than as a metric. `turnCount` and `toolCallCount` are the efficiency proxies hardware load cannot confound, so when they disagree with wall clock, believe them.

### 3.5 Reading rules

Three rules for reading the numbers above. Each one pairs a metric with the wrong conclusion a reader would otherwise draw from it.

1. **No consistency metric is read without its paired success rate.** Spread has no direction, so a server that becomes reliably wrong scores _better_ on `answerDispersion` than one that is usually right. The comparison CLI enforces this by refusing to render one without the other ([§3.3](#33-measuring-consistency)).
2. **A `parseFailures` spike invalidates the run rather than condemning the server.** It measures the serving stack, and it looks exactly like a server regression, because a model failing to emit well-formed tool calls is outwardly indistinguishable from a model given bad tool descriptions. Void the run and fix the serving config ([§3.2](#32-measuring-rejections-and-recovery)).
3. **When `serverLatency` and `turnCount` disagree, believe `turnCount`.** Latency moves with concurrency, other tenants, and serving flags that have nothing to do with the change under test. A turn count that rose means the model needed more round trips, whatever the clock says ([§3.4](#34-measuring-tokens-and-time)).

### 3.6 Metrics to avoid

- **Exact tool-call sequence match.** Overfits, and will fight the team every time a description improves.
- **Wall clock as a gate.** Report it; never fail a build on it. It moves with GPU load, other tenants, and serving flags that have nothing to do with this repo.
- **Cross-tier token totals.** Different tokenizers, so not a common unit.
- **Judge score as the headline number.** The noisiest and least interpretable metric available.
- **A single blended "quality score".** It hides which dimension moved, which is the only thing that would justify a decision.

### 3.7 How many phrasings per intent

Three to five. Fewer than three and `answerDispersion` has almost no room to show anything; many more and the run grows without adding much, because paraphrases of one question converge on the same handful of interpretations.

If R3 finds phrasing variance is high, the answer is more _intents_ rather than more phrasings per intent, since intent diversity buys more coverage than deeper paraphrasing of the same question.

**The phrasings have to be chosen, not generated at random.** Reworded synonyms of a single sentence test almost nothing. What is worth covering is the ways real requests actually differ: clinical versus colloquial vocabulary ("renal carcinoma" against "kidney cancer"), a filter stated as a range against a threshold ("aged 60 to 75" against "over 60"), an explicit field name against a description of it, and a terse phrase against a full sentence. Each of those probes a different part of the surface, which is why they carry more information per run than repetition does.

---

## 4. Dataset and case set

### 4.1 Working against the frozen dataset

Because the dataset is frozen, every outcome assertion can be exact and expectations only need to be derived once. Four mechanisms make that safe.

**Derive expectations once, then commit them.** `evals:bootstrap-expectations` computes each case's expected outcome by running one of its acceptable SQONs against Arranger, shows a diff for review, and writes it into the case file. A one-time step per case, worth having as a command so that adding a case never means hand-counting records.

**Fingerprint at run start, and abort on mismatch.** One check that the test environment is the one the expectations were derived from. This is not defence against expected drift, it is defence against a silent accident: an unannounced reindex, a catalogue configuration edit, or `ARRANGER_BASE_URL` pointed at the wrong instance. All three would present as an MCP regression, and all three are indistinguishable from one without the check. Recording the fingerprint in the manifest gives every baseline proof of what it ran against.

**Fingerprint through Arranger, not ES.** Derive it from `/introspection` plus a few fixed aggregation queries. This needs no ES credentials, covers catalogue **configuration** as well as data (the change most likely to happen on a testing server even when the data is frozen), and exercises the same path the MCP server uses.

**Use a read-only credential**, with sets, admin, and downloads disabled. The freeze is load-bearing for every number the suite produces, so the suite must not be what breaks it.

### 4.2 Case set format

One entry per **intent**, carrying every phrasing of it. Each phrasing of an intent shares the same set of expectations.

```
id                      stable identifier, referenced in results and baselines
category                answerable | unanswerable | ambiguous | improper
intent                  one line describing what the researcher wants to know
phrasings               [ "...", "..." ] verbatim and frozen; 1, or 3 to 5 on the
                        robustness subset ([§3.7](#37-how-many-phrasings-per-intent)). Every phrasing runs separately
                        against the same expectations below
entrypoint              raw prompt, or via the query_arranger MCP prompt
elicitationPolicy       accept | decline | timeout | not-advertised
expect:
  catalogue             expected catalogueId, or null
  requiredTools         set containment
  forbidden             named forbidden-pattern checks
  sqon                  array of acceptable SQONs, compared semantically
  result                exact total, primary keys, buckets (derived, not hand-written)
  rubric                judge rubric plus a reference answer
budget:
  maxToolCalls, maxTurns, maxWallClockMs
tiers                   which model tiers this case runs on (default: all)
```

Source intents from real failures rather than imagination. Every hit-or-miss SQON generation problem that motivated `build_sqon` (roadmap § MCP integration readiness) is an intent. Aim for roughly 30 across the four categories, weighted deliberately toward the negative ones, then grow the set from observed failures. Real failures also supply the best phrasings, since the wording that broke the server once is worth keeping forever.

**A model may draft phrasings; it must not decide what correct looks like.** Generating the expected answer with a model means measuring agreement with that model's beliefs about the dataset rather than correctness, and it encodes the same misunderstandings the server is supposed to prevent. It also makes the suite immune to the failure it exists to catch, since a model that misreads the catalogue the same way in both places scores a pass. Expectations are human-set, which is what the review diff in [§4.1](#41-working-against-the-frozen-dataset) is for.

---

## 5. Frameworks and architecture

### 5.1 Why this needs a custom harness

No framework will do the Arranger-specific work: fingerprint an external Arranger, open an MCP session in either local or remote mode, advertise and answer elicitation on a script, bridge MCP tool schemas to the serving API's tool format, run the loop with budgets, separate parser failures from server rejections, and assert Arranger semantics like SQON equivalence.

That is a few hundred lines specific to this repo, and part of it already exists in `integration-tests/mcp-server`. What a framework _can_ do is everything around it: run the suite, capture transcripts, plumb the judge, and write machine-readable artifacts. `vitest-evals` calls the part we write a **harness** and owns the rest, which is exactly that split ([§5.3.3](#533-runner-and-results-store)).

### 5.2 Tools considered

| Status                          | Name                                                                                     | Note                                                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recommended**                 | [`@modelcontextprotocol/sdk` v1](https://github.com/modelcontextprotocol/typescript-sdk) | MCP client, matching the server's current major.                                                                                                                                                                                                          |
| **Recommended**                 | [`openai` npm package](https://www.npmjs.com/package/openai)                             | Model client. Ollama, vLLM, SGLang, TGI and llama.cpp all expose an OpenAI-compatible chat completions API with `tools`, keeping the harness engine-independent. One Ollama caveat in [§5.3.2](#532-model-serving-and-the-determinism-assumption).        |
| **Recommended**                 | [`vitest-evals`](https://github.com/getsentry/vitest-evals)                              | Eval runner. Wraps our loop as a custom **harness** and supplies the suite, transcript capture, usage accounting, judge plumbing, and JSON artifacts. Pin the version: 0.x, and the harness abstraction is new ([§5.3.3](#533-runner-and-results-store)). |
| **Recommended**                 | [`@graphql-inspector/core`](https://the-guild.dev/graphql/inspector)                     | Arranger schema fingerprint, and a readable diff when it moves.                                                                                                                                                                                           |
| **Recommended**                 | [`simple-statistics`](https://simple-statistics.github.io)                               | Confidence intervals in the compare CLI.                                                                                                                                                                                                                  |
| Recommended<br>(separate track) | [promptfoo](https://www.promptfoo.dev/docs/providers/mcp/)                               | Its MCP provider treats the server as the target under test with explicit tools and deterministic assertions, plus red-team tooling. Right fit for the URGENT auth and rate-limit items in `tech-debt.md`; poor fit for multi-tier trajectory scoring.    |
| Reference                       | [mcp-eval](https://github.com/lastmile-ai/mcp-eval) (Python)                             | Best available reference for the metric taxonomy and assertion vocabulary. Wrong runtime for this team.                                                                                                                                                   |
| Deferred                        | [Langfuse](https://langfuse.com)                                                         | Self-hostable, so the data question has an answer. Revisit if trace visualization becomes the bottleneck.                                                                                                                                                 |
| Deferred                        | [DuckDB](https://duckdb.org)                                                             | Queries JSONL in place (`read_json_auto`); the natural analysis layer if the compare CLI outgrows itself.                                                                                                                                                 |
| Rejected                        | [Braintrust](https://www.braintrust.dev) and other hosted eval platforms                 | Prompts and transcripts contain real dataset records. Off-site is not an option, and it adds cost.                                                                                                                                                        |
| Rejected                        | [Vercel AI SDK](https://ai-sdk.dev)                                                      | Abstracts over the exact `usage` and tool-call fields the suite needs to read precisely, and has moved through three majors in twelve months.                                                                                                             |

### 5.3 Recommendation

Six thin layers, each independently swappable, all env-var configurable. L1 stays in the existing integration tests; L2 and L3 move to a new workspace running on `vitest-evals`, with our loop supplied as a custom harness. The two things worth getting right on day one are the record format and the manifest, because everything downstream is replaceable and those two are not.

#### 5.3.1 MCP client and tool-calling loop

Use `@modelcontextprotocol/sdk` 1.x on both sides. Keep client construction in a single module.

Own the agent loop, roughly 60 lines, because it needs per-turn hooks for usage accounting, budget enforcement, parse-failure classification, and transcript capture. Two of those four the runner provides once the loop is wrapped as a harness, and the other two are ours whichever runner is used, so the loop stays code we write either way ([§5.3.3](#533-runner-and-results-store)).

#### 5.3.2 Model serving and the determinism assumption

The `openai` client against `OPENAI_BASE_URL` keeps the harness independent of the serving engine. Two caveats, both cheap to handle and both expensive to discover late:

**Context window.** Ollama's [OpenAI-compatible endpoint cannot set `num_ctx`](https://docs.ollama.com/api/openai-compatibility) — it requires a Modelfile and `ollama create`. Ollama then silently clips anything over the limit, with no error. A truncated static surface produces a wrong `staticSurfaceTokens` reading in an undetectable direction, and truncated trajectories look like tool-selection failures attributable to the MCP server. Mitigation: pin `num_ctx` in a purpose-built Modelfile, record the resulting model digest in the manifest, and assert `prompt_tokens` against the configured window on every turn — failing the run rather than scoring it.

#### 5.3.3 Runner and results store

- **L1** stays in `integration-tests/mcp-server` on `node:test`, extending what exists. The static-surface token budget check and `surfaceStability` go here: no model, no reason to move them.
- **L2 and L3** go in a new `integration-tests/mcp-evals` workspace on `vitest-evals`, plus a separate `evals:compare` CLI.
    - Invoked explicitly, never from `npm test`. These are budgeted experiments, not tests, and should not sit where they can fail a build by accident. A separate workspace with its own Vitest config satisfies this, which also makes the Vitest-versus-`node:test` mismatch with the rest of the monorepo a non-issue.

**How the split works.** Our MCP session, elicitation driver, agent loop, budgets, and parse-failure classification all live inside a `createHarness` `run` function, which hands back the final output plus an ordered transcript. The runner takes it from there.

**One test per intent, phrasings looped inside it.** The aggregate metrics ([§3.3](#33-measuring-consistency)) cannot be computed across independent Vitest tests, and looping inside one test puts them where their inputs already are. Concurrency is pinned to 1 anyway ([§1.2](#12-greedy-sampling-and-measurements)), so there is no parallelism to give up.

**Record format.** Vitest writes one JSON report per invocation; [§1.1](#11-the-approach) specifies append-only JSONL, one record per run. A small flatten step bridges them, so the runner never owns the format.

#### 5.3.4 Scoring

Deterministic first, with `zod` schemas for `structuredContent` and the four `responseTypeMatch` classes. Report a set difference on primary keys rather than a boolean, so a failure names the records it disagreed about. Some contract checks come built into the runner; the rest are custom scorers over the harness transcript.

The judge is **never the model under test**: a model grading its own output brings self-preference bias, and it defeats R4's agreement check, because a judge sharing the subject's blind spots looks accurate on exactly the cases where both are wrong the same way. Configure it as a separate `judgeHarness` on `JUDGE_MODEL` ([§6](#6-configuration-contract)), ideally a larger tier, with constrained JSON output so the verdict is structured rather than parsed out of prose (Ollama's `format`, which is response-level and unrelated to the tool-argument constraining it lacks, [§3.2](#32-measuring-rejections-and-recovery)).

#### 5.3.5 Fingerprinting and the manifest

Canonical hashing via `safe-stable-stringify` and `node:crypto`, over the fields [§2](#2-what-is-being-pinned) enumerates: the Arranger-derived test environment fingerprint, the model and serving stack, the MCP surface hash and build identity, and the harness configuration. Two additions worth naming, since [§2](#2-what-is-being-pinned) describes what is pinned rather than how it is read: record a dirty-tree flag alongside the commit SHA, and serialise the harness config straight from the parsed env object rather than rebuilding it by hand, so the manifest cannot drift from what the run actually used.

#### 5.3.6 Comparison and significance

The compare CLI needs bootstrap confidence intervals and a stated minimum detectable effect. On a suite of a few dozen intents, a three-point move in `outcomeMatch` sits inside sampling noise, and without intervals the harness produces arguments instead of settling them. `simple-statistics` covers this in about thirty lines, and it is the difference between numbers that justify a change and numbers people debate.

### 5.4 Implementation considerations

#### 5.4.1 Local versus remote MCP server

Both are supported, selected by `MCP_MODE`. The surface hash works identically in either, since it is computed from the listing responses rather than from source.

**Local.** Reuses the `startMcpServerForTest` pattern from [startMcpServer.ts](../../integration-tests/mcp-server/test/startMcpServer.ts), pointed at the external Arranger rather than a locally started one. Fast iteration, exact commit attribution, and per-call timing without network noise. This is the default for development and CI.

**Remote.** Connects to a deployed MCP server over Streamable HTTP, which is what testing a real deployment and whatever auth sits in front of it requires. Two things block it:

- **Version attribution.** Nothing in the MCP surface reports which build is running, so a remote result cannot be tied to a commit, which breaks the comparison premise entirely. The fix is for the server to report a build identifier. Ask for it as a **dedicated resource**, mirrored into `initialize`'s `serverInfo.version` while v1 lasts — the resource survives the v2 migration, whereas server identity moves to result `_meta` and `clientInfo` is demoted to SHOULD. This belongs with the roadmap's "Arranger version exposure" item. **Until it exists, remote mode can smoke-test a deployment but cannot compare anything.**
- **Auth.** Once `MCP_API_KEY` lands (an URGENT tech-debt item), the harness has to send it. Build the header plumbing in from the start.

#### 5.4.2 Rebuild before local runs

`apps/mcp-server` resolves `@overture-stack/sqon` through `modules/sqon/dist` (`tech-debt.md`). A run that measures a stale `dist/` and attributes the result to the current commit is worse than no run at all, so the eval command must rebuild `file:` dependencies and record the built module hashes in the manifest.

---

## 6. Configuration contract

Per the repo convention in `AGENTS.md`, one module in the eval workspace reads `process.env`, validates with Zod, and exposes a typed config object. Nothing else touches `process.env`. The workspace also needs an `.env.schema` documenting every variable, since that file is the reference for whoever runs this next and is easy to forget.

**Arranger (upstream)**

- `ARRANGER_BASE_URL` (required)
- `ARRANGER_CATALOGUES` (optional comma list; default: all from `/introspection`)
- `ARRANGER_ENV_FINGERPRINT` (expected test environment fingerprint; run aborts on mismatch)
- `ARRANGER_ENV_FINGERPRINT_MODE` = `strict` (default) | `record` (bootstrap a new expected value)

**MCP server (system under test)**

- `MCP_MODE` = `local` | `remote`
- `MCP_SERVER_URL` (remote mode)
- `MCP_API_KEY` (remote mode, once implemented)
- `MCP_HOST`, `MCP_PORT`, `MCP_PATH` (local mode, mirroring `apps/mcp-server` config)
- `MCP_REQUEST_TIMEOUT_MS`
- `MCP_CLIENT_ELICITATION` = `advertise` | `withhold`

**Model server**

- `LLM_BASE_URL`, `LLM_API_KEY` (often a placeholder for local serving)
- `LLM_MODEL`, `LLM_MODEL_REVISION`, `LLM_TIER` = `small` | `medium` | `large`
- `LLM_TEMPERATURE` (0), `LLM_TOP_P`, `LLM_TOP_K`, `LLM_SEED`, `LLM_MAX_TOKENS`. Greedy is the only supported configuration ([§1.2](#12-greedy-sampling-and-measurements)); these exist to be recorded in the manifest and to make a deviation visible, not to be swept.
- `LLM_CONTEXT_LENGTH` (served window, for the context-fraction metric)
- `LLM_STRUCTURED_TOOL_ARGS` = `on` | `off` (`off`, since Ollama cannot do it; recorded so that it becoming `on` is visible rather than silent, the same reason the inert sampling values above are recorded)
- `LLM_SERVING_ENGINE`, `LLM_SERVING_VERSION`, `LLM_TOOL_TEMPLATE` (the model's tool-call template or parser, however the engine names it), `LLM_BATCH_INVARIANT` = `on` \| `off`. All operator-declared and recorded in the manifest, since the harness cannot read most of them from the API; check against `/v1/models` where possible.

**Judge**

- `JUDGE_BASE_URL`, `JUDGE_MODEL`, `JUDGE_TEMPERATURE` (usually the large tier, possibly a different endpoint)

**Run**

- `EVAL_REPEATS` (default 1; above 1 only for the greedy-stability check in R3)
- `EVAL_CONCURRENCY` (default 1), `EVAL_CASE_FILTER`, `EVAL_TIERS`, `EVAL_ROBUSTNESS_SUBSET` (which intents run all their phrasings)
- `EVAL_MAX_TOOL_CALLS`, `EVAL_MAX_TURNS`, `EVAL_MAX_WALLCLOCK_MS`
- `EVAL_OUT_DIR`, `EVAL_TRANSCRIPTS` = `on` | `off`

**Deliberately absent: ES credentials.** Fingerprinting through Arranger ([§4.1](#41-working-against-the-frozen-dataset)) removes the need, keeping the suite off the ES cluster entirely.

---

## 7. Implementation plan

### Phase 0: research spikes

Each spike can invalidate a design assumption, so all of them come before case authoring.

- **R1: end-to-end spike.** One hardcoded prompt through the harness against the testing Arranger, local MCP mode, one tier. Confirm that MCP tool schemas convert cleanly to the serving API's tool format (watch the Zod 3 versus Zod 4 skew in `tech-debt.md`), that per-turn `usage` is readable, that tool calls parse reliably, and that the elicitation request reaches a client-side handler and can be answered from a script. Three `vitest-evals` questions belong here too, because [§5.3.3](#533-runner-and-results-store) rests on them:
    - **Is `run(input)` callable several times inside one test?** The one-test-per-intent arrangement depends on it. Nothing in the documentation says it is once-per-test, and nothing says it is not.
    - **Can a custom harness carry an elicitation round trip?** Elicitation is the one part of our loop that is not request-response, and the harness documentation does not mention it. If it cannot, the harness boundary moves rather than the plan.
    - **What does the RFC's "replay/VCR policy" actually do?** If it means real replay from a stored session, it delivers L3's replayability ([§1.3](#13-three-layers-not-one-suite)) rather than us building it. Treat it as a possible bonus, not a dependency.
- **R2: serving-stack shakeout.** Which model tags actually emit well-formed tool calls, and the baseline parse-failure rate. Tool-argument constraining is not a question here: Ollama does not currently offer it (verified 2026-08-22), so re-check only on an engine change. On Ollama this is largely a question of the model's own tool template, so the spike is about choosing model tags rather than setting server flags; other engines expose it as explicit configuration instead (vLLM has `--enable-auto-tool-choice` and `--tool-call-parser`). Also confirm the context length is being applied, since a low default truncates silently ([§5.3.2](#532-model-serving-and-the-determinism-assumption)). **This must precede R3, because a high parse-failure rate makes every downstream metric uninterpretable.** Output: a pinned, documented serving config.
- **R3: greedy stability and phrasing noise floor.** Two measurements against an unchanged server, both before any cases are authored. First, one phrasing run 20 times: how often does greedy actually return the same trajectory and answer? **This validates the single-pass premise, so it comes before anything is built on it.** Second, several phrasings of one intent: how much does rewording move the result? That sets the smallest difference the suite can detect and the phrasings per intent ([§3.7](#37-how-many-phrasings-per-intent)). Record what the phrasings disagreed about, since that is a finding in itself and will likely reshape which intents get written in Phase 1.
- **R4: judge reliability.** Hand-label 20 stored answers, run the judge, measure agreement. If agreement is poor, rewrite the rubric or drop the judge layer. Do not build scoring on an unvalidated judge.
- **R5: tier range.** Does the small tier have usable range on a handful of cases, neither all-pass nor all-fail? Decides which tier carries the broad sweep. Lower priority than the spikes above it, since multi-tier work is deferred.
- **R6: fingerprint design.** Pick the Arranger-side signals (introspection hash plus a few fixed aggregations) that catch a reindex, a configuration edit, or a wrong `ARRANGER_BASE_URL`, without being so sensitive that a harmless restart trips them. Also confirm the freeze is a documented commitment rather than an assumption, and who else can write to that instance.
- **R7: run scope.** From R3 and R5, work out the wall clock for a full run at the chosen phrasing counts and tiers. If it is uncomfortable, cut scope now rather than in CI.

**Open questions for Phase 0:** whether transcripts containing real dataset records may be retained, and where; where committed baseline summaries live; whether anyone else could reindex the testing instance mid-run.

### Phase 1: case set and expectations

- Case schema (Zod) and roughly 30 cases across the four categories, traceable to real observed failures wherever possible.
- `evals:bootstrap-expectations`, deriving expected outcomes with a review diff.
- Fingerprint computation and the recorded expected value.

### Phase 2: harness

- `config.ts`: the single env-reading, Zod-validated module, plus `.env.schema`.
- `fingerprint.ts`: Arranger-side dataset and configuration fingerprinting.
- `mcpSession.ts`: local and remote modes behind one interface. Advertises `elicitation` and answers per the case policy, records every `tools/call` with arguments, duration, error flag, and result token count, and computes the surface hash.
- `harness.ts`: the `createHarness` wrapper. Its `run` holds the OpenAI-compatible client with greedy sampling passed per request ([§1.2](#12-greedy-sampling-and-measurements)), MCP-to-tools schema conversion, the loop with its budgets, per-turn usage accumulation, and parse-failure classification. Returns `output`, `events`, and `usage`; attaches the manifest and the rejection breakdown via `setArtifact`.
- `manifest.ts`: assembles and hashes everything in [§2](#2-what-is-being-pinned), including rebuilt module hashes in local mode and the reported server version in remote mode.
- Vitest project config for the workspace, kept out of the root `npm test` path.
- Transcript persistence comes from the runner's `session` plus its JSON artifact rather than bespoke code, still gated by `EVAL_TRANSCRIPTS`, so L3 is replayable and failures are debuggable without re-running the loop.

### Phase 3: scorers

Deterministic first, which is also descending order of signal:

1. `requiredToolsPresent` and `forbiddenPatterns`
2. `invalidCallRate` split into parse, schema, and semantic, plus `errorRecoveryWithinK`
3. `sqonEquivalence`, via `modules/sqon`, against the set of acceptable SQONs
4. `outcomeMatch`: exact totals, primary keys, and buckets
5. `tokenAccounting` per tier including context fraction, and `latencyAccounting` (reported, not gated)
6. `responseTypeMatch`, scored per category
7. `consistency`: `paraphraseRobustness` and answer dispersion. **These are aggregate scorers, computed across an intent's phrasings rather than per run, so they cannot be judges and cannot live in a per-run scorer.** They are computed in the test body after looping the phrasings ([§5.3.3](#533-runner-and-results-store)); build that shape first, since it determines what the per-run scorers have to return.
8. `answerQuality` (judge), last, and only if R4 passed

### Phase 4: reporting and comparison

This is the phase that delivers the stated goal, and the easiest to under-scope.

- A flatten step turning the Vitest JSON artifact into the append-only JSONL the rest of this phase consumes: one record per run, plus a run summary and the manifest ([§5.3.3](#533-runner-and-results-store)).
- `evals:compare <baseline> <candidate>`: paired per-case differences with intervals, per metric, per tier; a verdict of improved, regressed, or no detectable effect; and a loud warning when the manifests differ in more than the dimension under study.
- A per-case consistency view: `paraphraseRobustness` and distinct-answer count, beside the success rate so neither can be read without the other.
- A markdown summary suitable for pasting into a PR.
- Committed baseline **summaries** (small JSON, no transcripts) so a PR can cite what it was compared against.

### Phase 5: CI integration

- **Every PR: L1 only.** Contract tests plus the static-surface token budget per tier. No model server needed; the token budget needs only a tokenizer, which loads without a GPU.
- **Nightly and on manual dispatch:** one phrasing per intent, to catch breakage cheaply.
- **Weekly or pre-release:** every phrasing on the robustness subset ([§3.7](#37-how-many-phrasings-per-intent)), plus the judge layer. Results as artifacts, with a summary comment when dispatched from a PR.
- **Do not hardcode Elasticsearch.** The existing suite already takes `SEARCH_ENGINE`, and the OpenSearch-first migration wants integration suites runnable per engine. The harness talks to Arranger rather than the engine, which mostly insulates it, but the fingerprint logic should not assume ES-specific responses.
- **Typecheck from the start.** `integration-tests/mcp-server` is still never typechecked (open tech-debt); the new sibling workspace should have `strict` on and a real `tsc` step rather than repeating that.

### Phase 6: maintenance

- **Every real-world MCP failure becomes a case.** The only sustainable source of cases.
- **Watch for saturation.** A tier sitting at 100% has stopped measuring and needs harder cases.
- **Re-baseline deliberately** on any change to the serving config, model, quantization, test environment, or the pinned `vitest-evals` version, with a recorded manifest and a note in the roadmap. Serving-stack upgrades are the sneakiest, because pulling a new engine version or re-pulling a model tag can change tool-call behaviour with no change to this repo at all.
- **Never auto-promote a baseline.** A post-merge job that overwrites the baseline with the latest run launders every regression into the new normal, and the suite then reports "no detectable effect" indefinitely while quality drifts downward. Promotion is a deliberate, reviewed act with a stated reason.
- **Review the case set** whenever tools are added or descriptions change materially.

---

## 8. Risks

| Risk                                                                          | Mitigation                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tier token comparisons drawn by mistake                                 | Every token metric labelled with its tokenizer; comparison CLI refuses cross-tokenizer aggregation                                                                                                |
| Runs get slow enough that the suite stops being used                          | One phrasing per intent for the frequent signal, full phrasings weekly, prefix caching, hard per-case budgets                                                                                     |
| Tool-argument constraining switches on unnoticed and deflates `schemaInvalid` | Unavailable on Ollama today, so recorded in the manifest rather than designed around; treat a `schemaInvalid` cliff after an engine or model-tag change as this until proven otherwise            |
| A `vitest-evals` breaking change lands mid-suite                              | Version pinned and recorded in the manifest; coupling confined to our harness `run`, so the cost is an adapter rewrite; an upgrade is a re-baseline event ([§7](#7-implementation-plan), Phase 6) |

---

## 9. Sources

- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (transcript versus outcome, 20 to 50 cases, grader types, balanced problem sets, saturation; `paraphraseRobustness` is this plan's answer to its pass^k idea, with phrasings substituted for repeated trials)
- [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Ollama: OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) (the `/v1` surface and its `tools` support), plus the tokenize and detokenize endpoints ([ollama#12030](https://github.com/ollama/ollama/pull/12030)) and the Modelfile-parameters-ignored-on-`/v1` gotcha ([ollama#17744](https://github.com/ollama/ollama/issues/17744))
- [vLLM: Reproducibility](https://docs.vllm.ai/en/latest/usage/reproducibility/) and [Batch Invariance](https://docs.vllm.ai/en/latest/features/batch_invariance/) (why temperature 0 plus a fixed seed is not sufficient on a batching server; the batch-invariance mode Ollama has no equivalent of)
- [Defeating Nondeterminism in LLM Inference](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/) (batch-size dependence of reduction kernels as the real cause)
- [vLLM: Tool Calling](https://docs.vllm.ai/en/stable/features/tool_calling/) (`--enable-auto-tool-choice`, `--tool-call-parser`) and [Structured Outputs](https://developers.redhat.com/articles/2025/06/03/structured-outputs-vllm-guiding-ai-responses). The second is background for the [§8](#8-risks) row on tool-argument constraining, not something this suite does; Ollama has no equivalent today.
- [mcp-eval](https://mcp-eval.ai/) (metric taxonomy, path efficiency, OTel)
- [promptfoo MCP provider](https://www.promptfoo.dev/docs/providers/mcp/) and [MCP security testing](https://www.promptfoo.dev/docs/red-team/mcp-security-testing/)
- [vitest-evals](https://vitest-evals.sentry.dev/docs/) (the runner adopted in [§5.3.3](#533-runner-and-results-store)), in particular its [custom harness API](https://vitest-evals.sentry.dev/docs/harnesses/custom/) and the [harness-first RFC](https://github.com/getsentry/vitest-evals/blob/main/docs/harness-first-rfc.md) that explains what a harness owns
- [Evalite](https://www.evalite.dev/) and [mcp-evals](https://www.npmjs.com/package/mcp-evals), the runners considered and not chosen
