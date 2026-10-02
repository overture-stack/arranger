import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type Client } from '@modelcontextprotocol/client';

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

	test('2.returns two text messages: workflow, then the goal', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'donors over 50' },
		});

		// Two, not three: the SQON cheat sheet no longer rides along, because `build_sqon` writes
		// the filter now and the model never has to author SQON from a grammar.
		assert.equal(result.messages.length, 2, 'expected exactly two prompt messages');

		// Every message must be a text block on the 'user' role: PromptMessage has no system role,
		// so the workflow rides a user turn and the host is expected to hoist it into its own
		// system channel. getMessageText asserts both for each message.
		const [workflow, goal] = result.messages.map((message, index) => getMessageText(message, `message ${index}`));

		assert.ok(
			workflow.includes('You are a query assistant for the Arranger data portal.'),
			'expected message 0 to open with the query-assistant framing',
		);
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

	test('5.routes SQON construction through build_sqon instead of shipping a grammar', async () => {
		const result = await getClient().getPrompt({
			name: 'query_arranger',
			arguments: { goal: 'anything' },
		});

		// Regression guard: a message here once carried `type: 'resource'` wrapping the raw SQON
		// JSON Schema, which is silently dropped by clients that handle only text blocks.
		assert.ok(
			result.messages.every((message) => message.content.type === 'text'),
			'expected no non-text content blocks in the prompt',
		);

		const workflow = getMessageText(result.messages[0], 'message 0');
		assert.ok(workflow.includes('build_sqon'), 'expected the workflow to name build_sqon');
		assert.ok(
			workflow.indexOf('build_sqon') < workflow.indexOf('execute_query'),
			'expected build_sqon to be named before execute_query',
		);

		// The prompt must not reintroduce a hand-authored SQON path alongside the tool: a grammar
		// in context is an invitation to write the filter by hand and skip the validation.
		assert.ok(
			!workflow.includes('THE MISTAKE TO AVOID'),
			'expected the SQON cheat sheet not to be inlined into the prompt',
		);
		assert.ok(
			!workflow.includes('is provided in the next message'),
			'expected no pointer to a grammar message that is no longer sent',
		);
	});

	test('6.passes the researcher goal through verbatim', async () => {
		// Punctuation and quoting matter: the goal is interpolated into a message, so anything the
		// server mangles here changes what the model is asked to answer.
		const goal = 'female donors, age between 18 and 65, "primary_site" containing brain';
		const result = await getClient().getPrompt({ name: 'query_arranger', arguments: { goal } });

		assert.equal(getMessageText(result.messages[1], 'message 1'), `Researcher's goal: ${goal}`);
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
		// SDK v2 renders the failing path unquoted and directly after the prompt name
		// (`... query_arranger: goal: Too small`), where v1 quoted it as `"goal"`. Matching the
		// prompt-name-then-path shape pins the same thing without coupling to Zod's issue wording.
		await assert.rejects(
			() => getClient().getPrompt({ name: 'query_arranger', arguments: { goal: '' } }),
			(error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				assert.match(message, /Invalid arguments for prompt query_arranger/);
				assert.match(message, /query_arranger: goal\b/, 'expected the failing argument path to name goal');
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
