import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { approvalAnswer, confirmationAnswer, type PendingApproval, QuestionTable } from './answers.js';

const approval = (id = 'call-1/approval'): PendingApproval => ({
	kind: 'approval',
	id,
	runId: 'run-1',
	callId: 'call-1',
	server: 's',
	tool: 't',
	arguments: {},
	askedAt: new Date().toISOString(),
});

suite('QuestionTable', () => {
	test('accepts the first answer, and reports each later one as already answered', async () => {
		const table = new QuestionTable();
		const asked = table.ask(approval(), approvalAnswer, undefined, new AbortController().signal);

		assert.equal(table.pending().length, 1);
		assert.equal(table.respond('call-1/approval', { approve: true }), 'accepted');
		assert.equal(table.respond('call-1/approval', { approve: false }), 'already_answered');

		const settled = await asked;
		assert.equal(settled.by, 'answer');
		assert.deepEqual(settled.by === 'answer' && settled.answer, { approve: true });
		assert.deepEqual(table.pending(), []);
	});

	test('reports an id it never issued as unknown', () => {
		assert.equal(new QuestionTable().respond('nothing', { approve: true }), 'unknown');
	});

	test('settles a question that times out, and reports a late answer as timed out', async () => {
		const table = new QuestionTable();
		const settled = await table.ask(approval(), approvalAnswer, 20, new AbortController().signal);

		assert.equal(settled.by, 'timeout');
		assert.equal(table.respond('call-1/approval', { approve: true }), 'timed_out');
		assert.deepEqual(table.pending(), []);
	});

	test('withdraws a question when its signal aborts', async () => {
		const table = new QuestionTable();
		const controller = new AbortController();
		const asked = table.ask(approval(), approvalAnswer, undefined, controller.signal);
		controller.abort(new Error('stopped'));

		await assert.rejects(asked, /stopped/);
		assert.deepEqual(table.pending(), []);
		assert.equal(table.respond('call-1/approval', { approve: true }), 'already_answered');
	});

	test('refuses an answer of the wrong kind, and keeps the question open', async () => {
		const table = new QuestionTable();
		const controller = new AbortController();
		const asked = table.ask(approval(), approvalAnswer, undefined, controller.signal);

		assert.throws(() => table.respond('call-1/approval', { action: 'accept' }), TypeError);
		assert.equal(table.pending().length, 1);
		controller.abort();
		await assert.rejects(asked);
	});

	test('tells which calls wait on a confirmation', async () => {
		const table = new QuestionTable();
		const controller = new AbortController();
		const asked = table.ask(
			{
				kind: 'confirmation',
				id: 'call-2/1/confirm',
				runId: 'run-1',
				callId: 'call-2',
				server: 's',
				round: 1,
				key: 'confirm',
				message: 'Run it?',
				requestedSchema: {},
				askedAt: new Date().toISOString(),
			},
			confirmationAnswer,
			undefined,
			controller.signal,
		);

		assert.equal(table.isConfirming('call-2'), true);
		assert.equal(table.isConfirming('call-1'), false);
		assert.equal(table.respond('call-2/1/confirm', { action: 'decline' }), 'accepted');
		await asked;
		assert.equal(table.isConfirming('call-2'), false);
	});
});

suite('answer shapes', () => {
	test('tell approvals from confirmations', () => {
		assert.equal(approvalAnswer({ approve: false }), true);
		assert.equal(approvalAnswer({ action: 'accept' }), false);
		assert.equal(confirmationAnswer({ action: 'cancel' }), true);
		assert.equal(confirmationAnswer({ action: 'accept', content: { confirm: true } }), true);
		assert.equal(confirmationAnswer({ approve: true }), false);
		assert.equal(confirmationAnswer({ action: 'maybe' } as never), false);
	});
});
