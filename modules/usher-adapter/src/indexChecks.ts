import type { ConditionValidation, IndexProbe } from '@overture-stack/arranger-graphql-router';
import type { SqonNode } from '@overture-stack/sqon';
import type { BridgeLogger, RecordKeyRegistration } from '@overture-stack/usher-express-bridge';

import { ACCESS_CONTROL_EVENTS } from './events.js';

/** One category condition to check: its scoped name, and the resource it belongs to when it is that resource's own. */
type CategoryCheck = Readonly<{ categoryName: string; condition: SqonNode; resourceId?: string }>;

type Answer<Value> = Readonly<{ kind: 'answered'; value: Value }> | Readonly<{ cause: unknown; kind: 'unanswered' }>;

const isProblem = (problem: string | undefined): problem is string => problem !== undefined;

/** The probe method behind each check, naming it in the event a failure to answer logs. */
type ProbeCheck = 'countMatching' | 'countRecordsHoldingSeveralValues' | 'validate';

/** How deep a cause chain is followed, so a chain that loops still ends. */
const CAUSE_DEPTH = 8;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The report a search client's error carries from the engine, as both supported clients hold it. */
const engineReportOf = (error: Error): unknown =>
	'meta' in error && isRecord(error.meta) && isRecord(error.meta.body) ? error.meta.body.error : undefined;

/**
 * Each cause down `cause`'s chain as data a JSON line keeps, since an Error serializes to nothing: an
 * error's message with the engine's report where it carries one, and anything else as it is.
 */
const causeChainOf = (cause: unknown, depth = 0): unknown[] => {
	if (depth < CAUSE_DEPTH && cause instanceof Error) {
		const engineError = engineReportOf(cause);

		return [
			{ ...(engineError === undefined ? {} : { engineError }), message: cause.message },
			...causeChainOf(cause.cause, depth + 1),
		];
	}

	return depth < CAUSE_DEPTH && cause !== undefined ? [cause] : [];
};

/**
 * The probe's answer to `question`, or its failure when it rejects or throws: a check that could not run
 * refuses its catalogue rather than passing it.
 */
const answerOf = <Value>(question: () => Promise<Value>): Promise<Answer<Value>> =>
	Promise.resolve()
		.then(question)
		.then(
			(value): Answer<Value> => ({ kind: 'answered', value }),
			(cause: unknown): Answer<Value> => ({ cause, kind: 'unanswered' }),
		);

/** Every condition the registration defines, global and each resource's own; an absent category holds none. */
const categoryChecksOf = ({ categories }: RecordKeyRegistration): CategoryCheck[] => [
	...Object.entries(categories.global).flatMap(([categoryName, condition]) =>
		condition ? [{ categoryName, condition }] : [],
	),
	...Object.entries(categories.resource ?? {}).flatMap(([resourceId, conditions]) =>
		Object.entries(conditions ?? {}).flatMap(([categoryName, condition]) =>
			condition ? [{ categoryName, condition, resourceId }] : [],
		),
	),
];

/** The condition a category's records are counted under: a resource's own category within that resource alone. */
const countedConditionOf = ({ condition, resourceId }: CategoryCheck, resourceFieldName: string): SqonNode =>
	resourceId === undefined
		? condition
		: {
				content: [{ content: { fieldName: resourceFieldName, value: [resourceId] }, op: 'in' }, condition],
				op: 'and',
			};

const whereOf = (catalogueId: string, { categoryName, resourceId }: CategoryCheck): string =>
	resourceId === undefined
		? `catalogue "${catalogueId}", category "${categoryName}"`
		: `catalogue "${catalogueId}", category "${categoryName}" of resource "${resourceId}"`;

/**
 * What a startup event says about a category: its catalogue and name, the engine's explanation where
 * there is one, and its resource when it is that resource's own.
 */
const categoryFieldsOf = (
	catalogueId: string,
	{ categoryName, resourceId }: CategoryCheck,
	explanation?: string,
): Record<string, string> => ({
	catalogue: catalogueId,
	category: categoryName,
	...(explanation === undefined ? {} : { explanation }),
	...(resourceId === undefined ? {} : { resourceId }),
});

/**
 * Logs why the engine could not answer one check, on the server alone: its cause can quote a value, so the
 * refusal says only that the check could not run.
 */
const logUnanswered = (
	logger: BridgeLogger,
	{ cause, check, fields }: { cause: unknown; check: ProbeCheck; fields: Record<string, string> },
): void => {
	logger.error({ ...fields, cause: causeChainOf(cause), check }, ACCESS_CONTROL_EVENTS.startupCheckFailed);
};

const resourceFieldProblemOf = async ({
	catalogueId,
	logger,
	probe,
	resourceFieldName,
}: {
	catalogueId: string;
	logger: BridgeLogger;
	probe: IndexProbe;
	resourceFieldName: string;
}): Promise<string | undefined> => {
	const answer = await answerOf(() => probe.countRecordsHoldingSeveralValues(resourceFieldName));
	const field = `resource field "${resourceFieldName}"`;

	switch (answer.kind) {
		case 'answered': {
			const holding = answer.value === 1 ? '1 record holds' : `${answer.value} records hold`;

			return answer.value > 0
				? `catalogue "${catalogueId}": ${holding} more than one value in ${field}, while access is enforced on a resource field holding one value per record`
				: undefined;
		}
		case 'unanswered':
			logUnanswered(logger, {
				cause: answer.cause,
				check: 'countRecordsHoldingSeveralValues',
				fields: { catalogue: catalogueId, field: resourceFieldName },
			});
			return `catalogue "${catalogueId}": the check that ${field} holds one value per record could not run, so the catalogue is refused rather than served unchecked; its cause is logged as ${ACCESS_CONTROL_EVENTS.startupCheckFailed}`;
	}
};

type CategoryCheckOptions = Readonly<{
	catalogueId: string;
	check: CategoryCheck;
	logger: BridgeLogger;
	probe: IndexProbe;
	resourceFieldName: string;
}>;

/** Counts the records a valid condition matches, warning when it matches none. */
const countProblemOf = async ({
	catalogueId,
	check,
	logger,
	probe,
	resourceFieldName,
}: CategoryCheckOptions): Promise<string | undefined> => {
	const count = await answerOf(() => probe.countMatching(countedConditionOf(check, resourceFieldName)));

	switch (count.kind) {
		case 'answered':
			if (count.value === 0) {
				logger.warn(categoryFieldsOf(catalogueId, check), ACCESS_CONTROL_EVENTS.categoryMatchesNoRecord);
			}
			return undefined;
		case 'unanswered':
			logUnanswered(logger, {
				cause: count.cause,
				check: 'countMatching',
				fields: categoryFieldsOf(catalogueId, check),
			});
			return `${whereOf(catalogueId, check)}: the search engine could not count the records its condition matches, so the catalogue is refused rather than served unchecked; its cause is logged as ${ACCESS_CONTROL_EVENTS.startupCheckFailed}`;
	}
};

/** Refuses a condition the engine refuses, logging its explanation, and counts the records of one it accepts. */
const validationProblemOf = async (
	options: CategoryCheckOptions,
	validation: ConditionValidation,
): Promise<string | undefined> => {
	const { catalogueId, check, logger } = options;

	switch (validation.valid) {
		case true:
			return countProblemOf(options);
		case false:
			// The explanation can quote a value, so it reaches this server's log alone, never the refusal.
			logger.error(
				categoryFieldsOf(catalogueId, check, validation.explanation),
				ACCESS_CONTROL_EVENTS.conditionRefused,
			);
			return `${whereOf(catalogueId, check)}: the search engine refuses the query its condition compiles to; its explanation is logged as ${ACCESS_CONTROL_EVENTS.conditionRefused}`;
	}
};

/** Asks the engine whether it accepts the condition, then counts the records an accepted one matches. */
const categoryProblemOf = async (options: CategoryCheckOptions): Promise<string | undefined> => {
	const { catalogueId, check, logger, probe } = options;
	const answer = await answerOf(() => probe.validate(check.condition));

	switch (answer.kind) {
		case 'answered':
			return validationProblemOf(options, answer.value);
		case 'unanswered':
			logUnanswered(logger, {
				cause: answer.cause,
				check: 'validate',
				fields: categoryFieldsOf(catalogueId, check),
			});
			return `${whereOf(catalogueId, check)}: the search engine could not validate its condition, so the catalogue is refused rather than served unchecked; its cause is logged as ${ACCESS_CONTROL_EVENTS.startupCheckFailed}`;
	}
};

/**
 * Every reason access cannot be enforced on a record catalogue as its index holds it, asked of the
 * engine through the catalogue's probe once its registration and mapping have passed. No record may hold
 * more than one value in the resource field. Every category condition, global and each resource's own,
 * must be one the engine accepts, and is then counted, a resource's own within that resource: a
 * condition matching no record is logged as a warning rather than refused. A check the engine fails to
 * answer refuses the catalogue, its cause logged at error as `access_control.startup_check_failed`. Each
 * reason names the catalogue, and the field or category and its resource, never a value; the engine's
 * explanation of a refused condition is logged at error beside it.
 *
 * @param options the catalogue's key, its validated registration, its index's probe, and the logger
 *   each finding is written to.
 */
export const indexProblemsOf = async ({
	catalogueId,
	logger,
	probe,
	registration,
}: {
	catalogueId: string;
	logger: BridgeLogger;
	probe: IndexProbe;
	registration: RecordKeyRegistration;
}): Promise<string[]> => {
	const { resourceFieldName } = registration;
	const problems = await Promise.all([
		resourceFieldProblemOf({ catalogueId, logger, probe, resourceFieldName }),
		...categoryChecksOf(registration).map((check) =>
			categoryProblemOf({ catalogueId, check, logger, probe, resourceFieldName }),
		),
	]);

	return problems.filter(isProblem);
};
