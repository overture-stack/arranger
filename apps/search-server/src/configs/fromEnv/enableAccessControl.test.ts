import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, suite, test } from 'node:test';

const CHILD_TIMEOUT_MS = 30_000;
const FOLDER_CATALOGUE_IDS = ['alpha', 'beta'];
const RESTRICTED_STUDY = 'STUDY-A';
const RESULT_MARKER = '@@image-run-result@@';
const STARTUP_REFUSED_EVENT = 'access_control.startup_refused';

/** What the image logs as the source of its access-control decision. */
const IMAGE_SOURCE_LOG = {
	explicitFalse: 'explicit (set to false)',
	unset: 'defaulted (unset)',
};

/** What each catalogue's router logs about the filter it was given, one line per catalogue. */
const ROUTER_LOG = {
	configured: 'access control: filter configured',
	defaulted: 'access control: none (defaulted)',
	explicit: 'access control: none (explicit)',
};

const graphqlRouterUrl = import.meta.resolve('@overture-stack/arranger-graphql-router');
const serverModuleUrl = new URL('../../server.ts', import.meta.url).href;
const serverSideFiltersFixtureUrl = new URL(
	'../../../../../modules/graphql-router/src/accessControl/serverSideFilters.fixture.ts',
	import.meta.url,
).href;
const tsxLoaderUrl = import.meta.resolve('tsx');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arranger-enable-access-control-test-'));
after(() => fs.rmSync(temporaryRoot, { force: true, recursive: true }));

const writeCatalogueFile = (folderPath: string, catalogueId: string): void => {
	fs.mkdirSync(folderPath, { recursive: true });
	fs.writeFileSync(
		path.join(folderPath, 'base.json'),
		JSON.stringify({ catalogId: catalogueId, documentType: 'file', esIndex: `${catalogueId}_index` }),
	);
};

const subfolderPerCatalogueRoot = path.join(temporaryRoot, 'catalogues');
FOLDER_CATALOGUE_IDS.forEach((catalogueId) =>
	writeCatalogueFile(path.join(subfolderPerCatalogueRoot, catalogueId), catalogueId),
);

const oneCatalogueFolder = path.join(temporaryRoot, 'one-catalogue');
writeCatalogueFile(oneCatalogueFolder, 'solo');

/**
 * The three ways the image finds its catalogues, each a separate code path that has to carry the
 * image's access-control decision: no configs folder (the environment alone), one catalogue's files
 * directly in the folder, and a subfolder per catalogue.
 */
const CONFIGS_LAYOUTS = {
	none: {
		catalogueConfigsPath: path.join(temporaryRoot, 'no-configs-here'),
		catalogueCount: 1,
		graphqlPaths: ['/graphql'],
	},
	oneCatalogueFolder: { catalogueConfigsPath: oneCatalogueFolder, catalogueCount: 1, graphqlPaths: [] },
	subfolderPerCatalogue: {
		catalogueConfigsPath: subfolderPerCatalogueRoot,
		catalogueCount: FOLDER_CATALOGUE_IDS.length,
		graphqlPaths: [],
	},
};

type ConfigsLayout = keyof typeof CONFIGS_LAYOUTS;

/**
 * The image reads its whole configuration from the environment, so a developer's own
 * ENABLE_ACCESS_CONTROL, CONFIGS_PATH or ES_* would otherwise decide these outcomes. Only what a
 * process needs in order to run at all is inherited.
 */
const inheritedEnvironment = Object.fromEntries(
	['PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR'].flatMap((name) => {
		const value = process.env[name];
		return value === undefined ? [] : [[name, value]];
	}),
);

const catalogueEnvironment = { DOCUMENT_TYPE: 'file', ES_INDEX: 'file_centric' };

/**
 * Runs in a fresh process per scenario, because the image reads its environment once, when its
 * configuration module is first imported. It starts the image the way a host does, through
 * `arrangerServer` with an injected search client, and prints one result line for the parent.
 */
const CHILD_SOURCE = String.raw`
const scenario = JSON.parse(process.argv.at(-1));

const messageChain = (error) => (error ? [String(error.message ?? error), ...messageChain(error.cause)] : []);

const reportAndExit = (result) =>
	process.stdout.write(scenario.resultMarker + JSON.stringify(result) + '\n', () => process.exit(0));

const searchBodies = [];

const stubSearchClient = {
	cat: { aliases: async () => ({ body: [] }) },
	indices: {
		exists: async () => ({ body: true, statusCode: 200 }),
		getMapping: async ({ index }) => ({
			body: { [index]: { mappings: { properties: { name: { type: 'keyword' }, study: { type: 'keyword' } } } } },
		}),
	},
	search: async ({ body }) => {
		searchBodies.push(body);
		return {
			body: {
				_shards: { failed: 0, successful: 1, total: 1 },
				hits: { hits: [], total: { relation: 'eq', value: 0 } },
				timed_out: false,
				took: 0,
			},
		};
	},
};

const filtersOptionEntry = async (filtersOption) => {
	if (filtersOption === 'restricting') {
		const { restrictingFilter } = await import(scenario.serverSideFiltersFixtureUrl);
		return { filters: restrictingFilter({ fieldName: 'study', values: [scenario.restrictedStudy] }) };
	}

	if (filtersOption === 'includeEverything') {
		const { includeEverything } = await import(scenario.graphqlRouterUrl);
		if (typeof includeEverything === 'function') {
			return { filters: includeEverything };
		}
		throw new Error('@overture-stack/arranger-graphql-router exports no includeEverything function');
	}

	if (filtersOption === 'explicitlyUndefined') {
		return { filters: undefined };
	}

	if (filtersOption === 'null') {
		return { filters: null };
	}

	return {};
};

const askForHits = async (port, graphqlPath) => {
	const response = await fetch('http://127.0.0.1:' + port + graphqlPath, {
		body: JSON.stringify({ query: '{ file { hits { total } } }' }),
		headers: { 'content-type': 'application/json' },
		method: 'POST',
	});
	return { body: await response.json().catch(() => null), graphqlPath, status: response.status };
};

const run = async () => {
	const filters = await filtersOptionEntry(scenario.filtersOption).then(
		(entry) => ({ entry }),
		(error) => ({ error }),
	);
	if ('error' in filters) {
		return { messages: messageChain(filters.error), outcome: 'harnessError' };
	}

	const startup = await import(scenario.serverModuleUrl)
		.then(({ default: arrangerServer }) =>
			arrangerServer({
				catalogueConfigsPath: scenario.catalogueConfigsPath,
				esClient: stubSearchClient,
				serverPort: 0,
				...filters.entry,
			}),
		)
		.then(
			(server) => ({ server }),
			(error) => ({ error }),
		);
	if ('error' in startup) {
		return { messages: messageChain(startup.error), outcome: 'refused' };
	}

	await new Promise((resolve) => (startup.server.listening ? resolve() : startup.server.once('listening', resolve)));
	const responses = await Promise.all(
		scenario.graphqlPaths.map((graphqlPath) => askForHits(startup.server.address().port, graphqlPath)),
	);
	startup.server.close();

	return { messages: [], outcome: 'started', responses, searchBodies };
};

run().then(reportAndExit, (error) => reportAndExit({ messages: messageChain(error), outcome: 'harnessError' }));
`;

type FiltersOption = 'absent' | 'explicitlyUndefined' | 'includeEverything' | 'null' | 'restricting';

type ImageScenario = {
	configsLayout?: ConfigsLayout;
	/** Left out of the child's environment entirely when undefined, which is what "unset" means. */
	enableAccessControl?: string;
	filtersOption?: FiltersOption;
};

type ImageRun = {
	/** What the process wrote to stderr alone, where a refusal's detail is logged. */
	errorOutput: string;
	exitCode: number | null;
	messages: string[];
	outcome: 'exited' | 'harnessError' | 'refused' | 'started' | 'timedOut';
	/** Everything the process wrote to stdout and stderr, in order, without the result line. */
	output: string;
	responses: { body: unknown; graphqlPath: string; status: number }[];
	searchBodies: unknown[];
};

const REPORTED_OUTCOMES: ImageRun['outcome'][] = ['harnessError', 'refused', 'started'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const parseImageRun = ({
	errorOutput,
	exitCode,
	output,
	timedOut,
}: {
	errorOutput: string;
	exitCode: number | null;
	output: string;
	timedOut: boolean;
}): ImageRun => {
	const lines = output.split('\n');
	const resultLine = lines.findLast((line) => line.startsWith(RESULT_MARKER));
	const otherOutput = lines.filter((line) => !line.startsWith(RESULT_MARKER)).join('\n');
	const reported: unknown = resultLine ? JSON.parse(resultLine.slice(RESULT_MARKER.length)) : undefined;

	if (isRecord(reported)) {
		return {
			errorOutput,
			exitCode,
			messages: Array.isArray(reported.messages) ? reported.messages.map(String) : [],
			outcome: REPORTED_OUTCOMES.find((outcome) => outcome === reported.outcome) ?? 'harnessError',
			output: otherOutput,
			responses: Array.isArray(reported.responses) ? reported.responses : [],
			searchBodies: Array.isArray(reported.searchBodies) ? reported.searchBodies : [],
		};
	}

	return {
		errorOutput,
		exitCode,
		messages: [],
		outcome: timedOut ? 'timedOut' : 'exited',
		output: otherOutput,
		responses: [],
		searchBodies: [],
	};
};

const runImage = ({
	configsLayout = 'none',
	enableAccessControl,
	filtersOption = 'absent',
}: ImageScenario): Promise<ImageRun> =>
	new Promise((resolve) => {
		const { catalogueConfigsPath, graphqlPaths } = CONFIGS_LAYOUTS[configsLayout];
		const payload = {
			catalogueConfigsPath,
			filtersOption,
			graphqlPaths,
			graphqlRouterUrl,
			restrictedStudy: RESTRICTED_STUDY,
			resultMarker: RESULT_MARKER,
			serverModuleUrl,
			serverSideFiltersFixtureUrl,
		};

		const child = spawn(
			process.execPath,
			['--import', tsxLoaderUrl, '--input-type=module', '--eval', CHILD_SOURCE, JSON.stringify(payload)],
			{
				cwd: temporaryRoot,
				env: {
					...inheritedEnvironment,
					...catalogueEnvironment,
					...(enableAccessControl === undefined ? {} : { ENABLE_ACCESS_CONTROL: enableAccessControl }),
				},
			},
		);

		const outputChunks: string[] = [];
		const errorChunks: string[] = [];
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => outputChunks.push(chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
			outputChunks.push(chunk);
			errorChunks.push(chunk);
		});

		const killTimer = setTimeout(() => child.kill('SIGKILL'), CHILD_TIMEOUT_MS);
		child.on('close', (exitCode, signal) => {
			clearTimeout(killTimer);
			resolve(
				parseImageRun({
					errorOutput: errorChunks.join(''),
					exitCode,
					output: outputChunks.join(''),
					timedOut: signal === 'SIGKILL',
				}),
			);
		});
	});

/** Starts the image at most once per scenario, however many tests read the result. */
const sharedRun = (scenario: ImageScenario): (() => Promise<ImageRun>) => {
	const cache: { run?: Promise<ImageRun> } = {};
	return () => (cache.run ??= runImage(scenario));
};

const describeRun = (run: ImageRun): string =>
	[
		`outcome: ${run.outcome}, exit code: ${run.exitCode}`,
		...run.messages.map((message) => `message: ${message}`),
		'output, last 30 lines:',
		...run.output.split('\n').slice(-30),
	].join('\n');

const assertStarted = (run: ImageRun): void => {
	assert.equal(run.outcome, 'started', `expected the image to start\n${describeRun(run)}`);
};

/**
 * A rejected startup and a process that ends with a failing exit code before reporting are both
 * refusals: the image's own entry point turns the first into the second. A process that ends with
 * exit code 0 is not, because that reports success to whatever started it.
 */
const assertRefusedAtStartup = (run: ImageRun): void => {
	assert.ok(
		run.outcome === 'refused' || (run.outcome === 'exited' && run.exitCode !== 0),
		`expected startup to be refused\n${describeRun(run)}`,
	);
};

/**
 * Where the reason for a refusal is read. For a rejected startup that is the rejection's message
 * chain and stderr, but not the startup log on stdout: the image logs its access-control source
 * there, which can name ENABLE_ACCESS_CONTROL, and would then satisfy a check on a refusal that
 * happened for some unrelated reason. A process that exits before reporting leaves only its output.
 */
const refusalText = (run: ImageRun): string =>
	run.outcome === 'exited' ? run.output : [...run.messages, run.errorOutput].join('\n');

const countLinesContaining = (text: string, phrase: string): number =>
	text.split('\n').filter((line) => line.includes(phrase)).length;

const quotesRawValue = (text: string, rawValue: string): boolean =>
	[`"${rawValue}"`, `'${rawValue}'`, `\`${rawValue}\``, JSON.stringify(rawValue)].some((quoted) =>
		text.includes(quoted),
	);

const assertImageLoggedSource = (run: ImageRun, source: string): void => {
	Object.values(IMAGE_SOURCE_LOG).forEach((phrase) => {
		assert.equal(
			run.output.includes(phrase),
			phrase === source,
			`expected the image to log "${source}" as its access-control source, and no other\n${describeRun(run)}`,
		);
	});
};

const assertEveryCatalogueReports = (run: ImageRun, phrase: string, catalogueCount: number): void => {
	assert.equal(
		countLinesContaining(run.output, phrase),
		catalogueCount,
		`expected ${catalogueCount} line(s) reading "${phrase}"\n${describeRun(run)}`,
	);

	Object.values(ROUTER_LOG)
		.filter((otherPhrase) => otherPhrase !== phrase)
		.forEach((otherPhrase) => {
			assert.equal(
				countLinesContaining(run.output, otherPhrase),
				0,
				`did not expect "${otherPhrase}"\n${describeRun(run)}`,
			);
		});
};

const assertServedReads = (run: ImageRun): void => {
	assert.ok(run.responses.length > 0, `expected at least one read\n${describeRun(run)}`);

	run.responses.forEach((response) => {
		assert.equal(response.status, 200, `read of ${response.graphqlPath}: ${JSON.stringify(response.body)}`);
		assert.ok(
			isRecord(response.body) && response.body.errors === undefined && isRecord(response.body.data),
			`read of ${response.graphqlPath}: ${JSON.stringify(response.body)}`,
		);
	});
};

const asList = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}

	return value === undefined ? [] : [value];
};

/** Values a query requires `fieldName` to hold: `terms` reached only through `must` or `filter`, since one under `must_not` or `should` does not restrict. */
const requiredTermsValues = (clause: unknown, fieldName: string): unknown[] => {
	if (!isRecord(clause)) {
		return [];
	}

	const ownValues = isRecord(clause.terms) ? asList(clause.terms[fieldName]) : [];
	const requiredChildren = isRecord(clause.bool) ? [clause.bool.must, clause.bool.filter].flatMap(asList) : [];

	return [...ownValues, ...requiredChildren.flatMap((child) => requiredTermsValues(child, fieldName))];
};

const valueLabel = (rawValue: string): string => JSON.stringify(rawValue);

const unsetRun = sharedRun({});
const explicitFalseRun = sharedRun({ enableAccessControl: 'false' });

suite('search-server image: ENABLE_ACCESS_CONTROL unset', { concurrency: 3 }, () => {
	test('starts and serves reads, as every deployment that predates the variable does', async () => {
		const run = await unsetRun();

		assertStarted(run);
		assertServedReads(run);
	});

	test('logs the source of its access-control decision as defaulted (unset)', async () => {
		const run = await unsetRun();

		assertStarted(run);
		assertImageLoggedSource(run, IMAGE_SOURCE_LOG.unset);
	});

	test('passes the router no filter at all, so the catalogue reports access control as none (defaulted)', async () => {
		const run = await unsetRun();

		assertStarted(run);
		assertEveryCatalogueReports(run, ROUTER_LOG.defaulted, 1);
	});
});

suite('search-server image: ENABLE_ACCESS_CONTROL set to false or 0', { concurrency: 4 }, () => {
	const falseSpellings = [
		{ rawValue: 'false', run: explicitFalseRun },
		...['0', 'FALSE', ' False ', '\t0\n'].map((rawValue) => ({
			rawValue,
			run: sharedRun({ enableAccessControl: rawValue }),
		})),
	];

	falseSpellings.forEach(({ rawValue, run: falseRun }) => {
		test(`starts and logs the source as explicit (set to false), given ${valueLabel(rawValue)}`, async () => {
			const run = await falseRun();

			assertStarted(run);
			assertImageLoggedSource(run, IMAGE_SOURCE_LOG.explicitFalse);
		});

		test(`passes the router includeEverything, so the catalogue reports none (explicit), given ${valueLabel(rawValue)}`, async () => {
			const run = await falseRun();

			assertStarted(run);
			assertEveryCatalogueReports(run, ROUTER_LOG.explicit, 1);
		});
	});

	test('serves exactly the reads an unset variable serves, since both mean no access control', async () => {
		const [unset, explicitFalse] = await Promise.all([unsetRun(), explicitFalseRun()]);

		assertStarted(unset);
		assertStarted(explicitFalse);
		assertServedReads(explicitFalse);
		assert.ok(unset.searchBodies.length > 0, describeRun(unset));
		assert.deepEqual(explicitFalse.searchBodies, unset.searchBodies);
	});
});

suite('search-server image: ENABLE_ACCESS_CONTROL set to true or 1', { concurrency: 4 }, () => {
	['true', '1', 'TRUE', ' True ', '\t1\n'].forEach((rawValue) => {
		test(`refuses to start, saying this build has no Usher adapter, given ${valueLabel(rawValue)}`, async () => {
			const run = await runImage({ enableAccessControl: rawValue });

			assertRefusedAtStartup(run);
			assert.match(refusalText(run), /usher/i);
		});
	});
});

suite('search-server image: ENABLE_ACCESS_CONTROL set to any other value', { concurrency: 4 }, () => {
	const unrecognizedValues = [
		{ rawValue: '', why: 'an empty value, which is not the same as unset' },
		{ rawValue: '   ', why: 'a whitespace-only value, which trims to empty rather than to unset' },
		{ rawValue: '\t', why: 'a tab, which trims to empty rather than to unset' },
		{
			rawValue: 'yes',
			why: 'a word other parsers read as on, so reading it as off would drop what the operator asked for',
		},
		{
			rawValue: 'on',
			why: 'a word other parsers read as on, so reading it as off would drop what the operator asked for',
		},
		{ rawValue: 'no', why: 'a word other parsers read as off' },
		{ rawValue: 'off', why: 'a word other parsers read as off' },
		{ rawValue: '2', why: 'a number other than 0 or 1' },
		{ rawValue: '01', why: 'a number that only parses to 1' },
		{ rawValue: '0.0', why: 'a number that only parses to 0' },
		{ rawValue: 'null', why: 'what a template can render for a missing value' },
		{ rawValue: 'undefined', why: 'what a template can render for a missing value' },
		{ rawValue: '<no value>', why: 'what a Go template renders for a missing key' },
		{ rawValue: 'flase', why: 'a misspelling of false' },
		{ rawValue: 'falsey', why: 'a word that only begins with false' },
		{ rawValue: 'ture', why: 'a misspelling of true' },
	];

	unrecognizedValues.forEach(({ rawValue, why }) => {
		test(`refuses to start given ${valueLabel(rawValue)}, ${why}, quoting the raw value`, async () => {
			const run = await runImage({ enableAccessControl: rawValue });

			assertRefusedAtStartup(run);
			assert.match(refusalText(run), /ENABLE_ACCESS_CONTROL/);
			assert.ok(quotesRawValue(refusalText(run), rawValue), describeRun(run));
		});
	});
});

const assertRefusedAsContradiction = (run: ImageRun): void => {
	assertRefusedAtStartup(run);
	assert.match(refusalText(run), /ENABLE_ACCESS_CONTROL/, describeRun(run));
	assert.match(refusalText(run), /filters/, describeRun(run));
};

suite("search-server image: a host's programmatic filters option", { concurrency: 4 }, () => {
	// "0" as well as "false": a contradiction check that compares the raw text with "false" would
	// let every other spelling of false through.
	['false', '0'].forEach((rawValue) => {
		test(`refuses to start when filters is combined with ENABLE_ACCESS_CONTROL set to ${valueLabel(rawValue)}, since the two contradict each other`, async () => {
			const run = await runImage({ enableAccessControl: rawValue, filtersOption: 'restricting' });

			assertRefusedAsContradiction(run);
		});
	});

	test("refuses includeEverything as filters combined with false too, since includeEverything's identity is only ever reported, never decided on", async () => {
		const run = await runImage({ enableAccessControl: 'false', filtersOption: 'includeEverything' });

		assertRefusedAsContradiction(run);
	});

	test('refuses a null filters option combined with false, rather than reading null as absent the way undefined is', async () => {
		const run = await runImage({ enableAccessControl: 'false', filtersOption: 'null' });

		assertRefusedAtStartup(run);
		assert.match(refusalText(run), /filters/, describeRun(run));
	});

	test('refuses to start when filters is combined with ENABLE_ACCESS_CONTROL=true, since a host filter does not stand in for the Usher adapter', async () => {
		const run = await runImage({ enableAccessControl: 'true', filtersOption: 'restricting' });

		assertRefusedAtStartup(run);
		assert.match(refusalText(run), /usher/i, describeRun(run));
	});

	test('treats an explicitly undefined filters option as absent, so false still starts and passes includeEverything', async () => {
		const run = await runImage({ enableAccessControl: 'false', filtersOption: 'explicitlyUndefined' });

		assertStarted(run);
		assertImageLoggedSource(run, IMAGE_SOURCE_LOG.explicitFalse);
		assertEveryCatalogueReports(run, ROUTER_LOG.explicit, 1);
	});

	test("still requires the host's filter on every read when ENABLE_ACCESS_CONTROL is unset", async () => {
		const run = await runImage({ filtersOption: 'restricting' });

		assertStarted(run);
		assertServedReads(run);
		assert.ok(run.searchBodies.length > 0, describeRun(run));
		run.searchBodies.forEach((searchBody) => {
			const query = isRecord(searchBody) ? searchBody.query : undefined;
			assert.deepEqual(
				[...new Set(requiredTermsValues(query, 'study'))],
				[RESTRICTED_STUDY],
				JSON.stringify(searchBody),
			);
		});
	});
});

suite('search-server image: catalogues loaded from a configs folder', { concurrency: 4 }, () => {
	const folderLayouts: { configsLayout: ConfigsLayout; description: string }[] = [
		{ configsLayout: 'oneCatalogueFolder', description: "one catalogue's files directly in the folder" },
		{ configsLayout: 'subfolderPerCatalogue', description: 'a subfolder per catalogue' },
	];

	folderLayouts.forEach(({ configsLayout, description }) => {
		const { catalogueCount } = CONFIGS_LAYOUTS[configsLayout];

		test(`with ENABLE_ACCESS_CONTROL=false and ${description}, passes every catalogue's router includeEverything`, async () => {
			const run = await runImage({ configsLayout, enableAccessControl: 'false' });

			assertStarted(run);
			assertEveryCatalogueReports(run, ROUTER_LOG.explicit, catalogueCount);
		});
	});

	test("with ENABLE_ACCESS_CONTROL unset and a subfolder per catalogue, passes every catalogue's router nothing", async () => {
		const run = await runImage({ configsLayout: 'subfolderPerCatalogue' });

		assertStarted(run);
		assertEveryCatalogueReports(run, ROUTER_LOG.defaulted, CONFIGS_LAYOUTS.subfolderPerCatalogue.catalogueCount);
	});

	test('with ENABLE_ACCESS_CONTROL=true and a subfolder per catalogue, refuses the whole startup rather than starting with every catalogue failed', async () => {
		const run = await runImage({ configsLayout: 'subfolderPerCatalogue', enableAccessControl: 'true' });

		assertRefusedAtStartup(run);
		assert.match(refusalText(run), /usher/i, describeRun(run));
	});
});

suite(`search-server image: the ${STARTUP_REFUSED_EVENT} event`, { concurrency: 4 }, () => {
	const refusals: { description: string; scenario: ImageScenario }[] = [
		{ description: 'ENABLE_ACCESS_CONTROL set to true', scenario: { enableAccessControl: 'true' } },
		{ description: 'an unrecognized ENABLE_ACCESS_CONTROL', scenario: { enableAccessControl: 'yes' } },
		{
			description: 'an unrecognized ENABLE_ACCESS_CONTROL holding a line break',
			scenario: { enableAccessControl: 'yes\nno' },
		},
		{
			description: 'filters combined with ENABLE_ACCESS_CONTROL set to false',
			scenario: { enableAccessControl: 'false', filtersOption: 'restricting' },
		},
	];

	refusals.forEach(({ description, scenario }) => {
		test(`is logged on stderr as one line given ${description}, carrying the refusal's own message and nothing more`, async () => {
			const run = await runImage(scenario);

			assertRefusedAtStartup(run);
			assert.deepEqual(
				run.errorOutput.split('\n').filter((line) => line.includes(STARTUP_REFUSED_EVENT)),
				[`${STARTUP_REFUSED_EVENT} ${run.messages[0]}`],
				describeRun(run),
			);
		});
	});

	[
		{ description: 'ENABLE_ACCESS_CONTROL unset', run: unsetRun },
		{ description: 'ENABLE_ACCESS_CONTROL set to false', run: explicitFalseRun },
	].forEach(({ description, run: startedRun }) => {
		test(`is not logged when the image starts, given ${description}`, async () => {
			const run = await startedRun();

			assertStarted(run);
			assert.equal(countLinesContaining(run.output, STARTUP_REFUSED_EVENT), 0, describeRun(run));
		});
	});
});
