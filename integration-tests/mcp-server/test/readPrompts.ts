import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/sdk/client';

export type PromptEnv = {
	getClient: () => Client;
	configuredCatalogues: string[];
	expectedDocumentTypes: Record<string, string>;
};

type PromptMessage = Awaited<ReturnType<Client['getPrompt']>>['messages'][number];

/**
 * Prompt messages carry a content union (text, image, audio, resource). `query_arranger` must send
 * text-only: an embedded resource is silently dropped by clients that handle only `type: 'text'`,
 * which would leave the model told that a SQON grammar it cannot see exists in the next message.
 */
const getMessageText = (message: PromptMessage, label: string): string => {
	assert.equal(message.role, 'user', `${label}: expected the 'user' role`);
	assert.equal(message.content.type, 'text', `${label}: expected a text block, got '${message.content.type}'`);
	assert.equal(typeof message.content.text, 'string', `${label}: expected text to be a string`);
	return message.content.text as string;
};

export default ({ getClient, configuredCatalogues, expectedDocumentTypes }: PromptEnv) => {
	test("1.lists 'query_arranger' with a required 'goal' argument", async () => {
		const { prompts } = await getClient().listPrompts();
		const prompt = prompts.find((p) => p.name === 'query_arranger');
		assert.ok(prompt, 'expected query_arranger to be registered');
		assert.equal(prompt?.title, 'Query Arranger');
		assert.equal(typeof prompt?.description, 'string');

		const args = prompt?.arguments ?? [];
		assert.equal(args.length, 1, 'expected exactly one prompt argument');
		assert.equal(args[0]?.name, 'goal');
		assert.equal(args[0]?.required, true);
		assert.equal(typeof args[0]?.description, 'string');
	});

	test('2.returns three text messages: workflow, SQON grammar, then the goal', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'donors over 50' },
		});

		assert.equal(result.messages.length, 3, 'expected exactly three prompt messages');

		// Every message must be a text block on the 'user' role: PromptMessage has no system role,
		// so the workflow rides a user turn and the host is expected to hoist it into its own
		// system channel. getMessageText asserts both for each message.
		const [workflow, grammar, goal] = result.messages.map((message, index) =>
			getMessageText(message, `message ${index}`),
		);

		assert.ok(
			workflow.includes('You are a query assistant for the Arranger data portal.'),
			'expected message 0 to open with the query-assistant framing',
		);
		assert.ok(grammar.includes('SQON cheat sheet'), 'expected message 1 to be the SQON cheat sheet');
		assert.equal(goal, "Researcher's goal: donors over 50");
	});

	test('3.renders every configured catalogue and its document type into the workflow message', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'anything' },
		});
		const workflow = getMessageText(result.messages[0], 'message 0');

		assert.ok(workflow.includes('## Available catalogues'), 'expected an available-catalogues section');

		for (const catalogueId of configuredCatalogues) {
			const entry = `- ${catalogueId} (document type: ${expectedDocumentTypes[catalogueId]})`;
			assert.ok(workflow.includes(entry), `expected catalogue summary line '${entry}'`);
		}

		// The no-matching-catalogue branch reads back the full ID list, so the model can offer
		// alternatives instead of inventing a catalogue name.
		assert.ok(
			workflow.includes(`The available catalogues are: ${configuredCatalogues.join(', ')}.`),
			'expected the catalogue ID list in the no-match response template',
		);
	});

	test('4.instructs the model to load field metadata via get_catalogue_fields and to classify the question', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'anything' },
		});
		const workflow = getMessageText(result.messages[0], 'message 0');

		assert.ok(workflow.includes('get_catalogue_fields'), 'expected the workflow to name get_catalogue_fields');

		for (const questionType of ['Answerable', 'Unanswerable', 'Ambiguous', 'Improper']) {
			assert.ok(workflow.includes(questionType), `expected the '${questionType}' question type`);
		}

		assert.ok(
			workflow.includes('Do not execute until the researcher confirms.'),
			'expected the confirmation gate in the Answerable branch',
		);
	});

	test('5.sends SQON generation guidance inline rather than as an embedded resource', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'anything' },
		});

		// Regression guard: message 1 previously carried `type: 'resource'` wrapping the raw SQON
		// JSON Schema. The JSON Schema is the validation artifact; the cheat sheet is the generation
		// guide, and it has to survive clients that ignore non-text content blocks.
		assert.ok(
			result.messages.every((message) => message.content.type === 'text'),
			'expected no non-text content blocks in the prompt',
		);

		const grammar = getMessageText(result.messages[1], 'message 1');
		assert.ok(grammar.includes('fieldName'), 'expected the cheat sheet to name the fieldName key');
		assert.ok(grammar.includes('THE MISTAKE TO AVOID'), 'expected the leaf-shape pitfall callout');
		assert.ok(
			grammar.includes('{"op": "<field op>", "content": {"fieldName": "<field>", "value": <value>}}'),
			'expected a copyable leaf template',
		);
		assert.ok(
			grammar.includes('get_sqon_schema'),
			'expected the cheat sheet to point at get_sqon_schema for the machine-readable schema',
		);

		// The workflow message points at message 1 for the grammar; if that pointer and the
		// message order ever drift apart, the model is told to read something that is not there.
		const workflow = getMessageText(result.messages[0], 'message 0');
		assert.ok(
			workflow.includes('is provided in the next message'),
			'expected the workflow to point at the following message for the grammar',
		);
	});

	test('6.passes the researcher goal through verbatim', async () => {
		// Punctuation and quoting matter: the goal is interpolated into a message, so anything the
		// server mangles here changes what the model is asked to answer.
		const goal = 'female donors, age between 18 and 65, "primary_site" containing brain';
		const result = await getClient().getPrompt({ name: 'query_arranger', arguments: { goal } });

		assert.equal(getMessageText(result.messages[2], 'message 2'), `Researcher's goal: ${goal}`);
	});

	// The assertions below match on the error text, not just on "it rejected". A bare rejection
	// assertion passes for any failure, including an unrelated transport error, which is how a test
	// ends up asserting the right outcome for the wrong reason.
	test('7.rejects a missing or empty goal argument', async () => {
		// Omitting `arguments` entirely fails as a missing object, so the zod issue has an empty
		// path and the message cannot name `goal`. Asserting on the prompt name is what
		// distinguishes argument validation from an unrelated transport failure here.
		await assert.rejects(
			() => getClient().getPrompt({ name: 'query_arranger' }),
			/Invalid arguments for prompt query_arranger/,
			'expected a missing arguments object to fail prompt argument validation',
		);

		// An empty string does reach the field, so this one can be pinned to `goal` specifically.
		await assert.rejects(
			() => getClient().getPrompt({ name: 'query_arranger', arguments: { goal: '' } }),
			(error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				assert.match(message, /Invalid arguments for prompt query_arranger/);
				assert.match(message, /"goal"/, 'expected the failing argument path to name goal');
				return true;
			},
			'expected an empty goal to be rejected by the min(1) constraint',
		);
	});

	test('8.rejects an unknown prompt name', async () => {
		await assert.rejects(
			() => getClient().getPrompt({ name: 'this_prompt_does_not_exist', arguments: { goal: 'anything' } }),
			/this_prompt_does_not_exist/,
			'expected an unknown prompt name to be rejected, naming the prompt',
		);
	});
};
