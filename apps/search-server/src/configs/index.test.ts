import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, mock, suite, test } from 'node:test';

import loadAllConfigs, { describeUnreadableEntry } from './index.js';

const tempDirs: string[] = [];

const makeDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arranger-configs-index-test-'));
	tempDirs.push(dir);
	return dir;
};

const writeJson = (dir: string, filename: string, contents: string) => {
	fs.writeFileSync(path.join(dir, filename), contents, 'utf8');
};

/** Mounts `files` into `dir` the way Kubernetes mounts a ConfigMap: hidden timestamped data, `..data` link, relative file links. */
const mountConfigMap = (dir: string, files: Record<string, string>, timestamp = '2026_11_22_09_30_15.123456789') => {
	const dataDir = path.join(dir, `..${timestamp}`);
	fs.mkdirSync(dataDir, { recursive: true });
	Object.entries(files).forEach(([filename, contents]) => writeJson(dataDir, filename, contents));
	fs.symlinkSync(`..${timestamp}`, path.join(dir, '..data'));
	Object.keys(files).forEach((filename) => fs.symlinkSync(path.join('..data', filename), path.join(dir, filename)));
};

const cleanup = () => {
	while (tempDirs.length) {
		fs.rmSync(tempDirs.pop() as string, { recursive: true, force: true });
	}
};

afterEach(cleanup);
after(cleanup);

suite('describeUnreadableEntry', () => {
	test('names a link whose target is gone as no longer existing or pointing at nothing', () => {
		assert.deepEqual(describeUnreadableEntry('gone', { code: 'ENOENT', message: 'ENOENT: no such file' }), {
			details: { code: 'ENOENT', entry: 'gone', reason: 'unreadable' },
			message:
				'Skipped "gone" in the configs folder: it no longer exists, or is a link to something that does not exist.',
		});
	});

	test('names a permission failure as the server having no permission to reach the entry', () => {
		assert.deepEqual(describeUnreadableEntry('locked', { code: 'EPERM', message: 'EPERM: denied' }), {
			details: { code: 'EPERM', entry: 'locked', reason: 'unreadable' },
			message: 'Skipped "locked" in the configs folder: the server has no permission to reach it.',
		});
	});

	test('names any other error code in the warning', () => {
		assert.deepEqual(describeUnreadableEntry('loop', { code: 'ELOOP', message: 'ELOOP: too many links' }), {
			details: { code: 'ELOOP', entry: 'loop', reason: 'unreadable' },
			message: 'Skipped "loop" in the configs folder: it could not be reached (ELOOP).',
		});
	});

	test('with no error code, gives the error message in place of the code, without doubling a trailing period, and omits the code from the details', () => {
		assert.deepEqual(describeUnreadableEntry('odd', { message: 'socket hang up.' }), {
			details: { entry: 'odd', reason: 'unreadable' },
			message: 'Skipped "odd" in the configs folder: it could not be reached: socket hang up.',
		});
	});

	test('with no error code, ends the message with a period when the error message has none', () => {
		assert.deepEqual(describeUnreadableEntry('odd', { message: 'socket hang up' }), {
			details: { entry: 'odd', reason: 'unreadable' },
			message: 'Skipped "odd" in the configs folder: it could not be reached: socket hang up.',
		});
	});
});

suite('loadAllConfigs', () => {
	test('falls back to env-only config when the configs directory does not exist', async () => {
		const missingDir = path.join(os.tmpdir(), 'arranger-configs-index-test-does-not-exist');

		const result = await loadAllConfigs({
			catalogueConfigsPath: missingDir,
			currentDirectory: '',
		});

		assert.ok(result.catalogs && 'fromEnv' in result.catalogs);
	});

	test('a malformed catalogue directory is skipped, healthy sibling catalogues still register', async () => {
		const root = makeDir();
		fs.mkdirSync(path.join(root, 'healthy'));
		fs.mkdirSync(path.join(root, 'broken'));
		writeJson(root + '/healthy', 'base.json', JSON.stringify({ documentType: 'file' }));
		writeJson(root + '/broken', 'base.json', '{ not valid json');

		const result = await loadAllConfigs({
			catalogueConfigsPath: root,
			currentDirectory: '',
		});

		assert.deepEqual(Object.keys(result.catalogs ?? {}), ['healthy']);
	});

	suite('a configuration directory laid out for 3.0', () => {
		/** A start directory holding `base.json` with `documentType` under each of `relativeDirectories`. */
		const startDirectoryWith = (...layouts: [relativeDirectory: string, documentType: string][]) => {
			const root = makeDir();
			layouts.forEach(([relativeDirectory, documentType]) => {
				fs.mkdirSync(path.join(root, relativeDirectory), { recursive: true });
				writeJson(path.join(root, relativeDirectory), 'base.json', JSON.stringify({ documentType }));
			});
			return root;
		};

		const documentTypesOf = (result: Awaited<ReturnType<typeof loadAllConfigs>>) =>
			Object.values(result.catalogs ?? {}).map(
				(catalogue) => (catalogue as { documentType?: string }).documentType,
			);

		test('is read from where 3.0 resolved it, with one deprecation warning, when the 3.1 location is missing', async () => {
			// Given configuration only under modules/server, where 3.0 resolved ./configs
			const root = startDirectoryWith([path.join('modules', 'server', 'configs'), 'from-3.0-location']);
			const emitWarning = mock.method(process, 'emitWarning', () => undefined);

			// When the configuration loads with the default relative path
			const result = await loadAllConfigs({ catalogueConfigsPath: './configs', currentDirectory: root });
			emitWarning.mock.restore();

			// Then the catalogue comes from there, and one deprecation warning says so under its code
			assert.deepEqual(documentTypesOf(result), ['from-3.0-location']);
			const codes = emitWarning.mock.calls.map(
				(call) => (call.arguments[1] as { code?: string } | undefined)?.code,
			);
			assert.deepEqual(codes, ['ARRANGER_CONFIGS_LOCATION']);
		});

		test('is ignored, with no warning, where the 3.1 location exists', async () => {
			const root = startDirectoryWith(
				['configs', 'from-3.1-location'],
				[path.join('modules', 'server', 'configs'), 'from-3.0-location'],
			);
			const emitWarning = mock.method(process, 'emitWarning', () => undefined);

			const result = await loadAllConfigs({ catalogueConfigsPath: './configs', currentDirectory: root });
			emitWarning.mock.restore();

			assert.deepEqual(documentTypesOf(result), ['from-3.1-location']);
			assert.equal(emitWarning.mock.callCount(), 0);
		});
	});

	suite('discovering catalogues from symbolic links and hidden entries', () => {
		const documentTypesOf = (result: Awaited<ReturnType<typeof loadAllConfigs>>) =>
			Object.values(result.catalogs ?? {}).map(
				(catalogue) => (catalogue as { documentType?: string }).documentType,
			);

		test('a ConfigMap mounted directly at the configs path loads as one catalogue from its linked base.json', async () => {
			const root = makeDir();
			mountConfigMap(root, { 'base.json': JSON.stringify({ documentType: 'mounted-configmap' }) });

			const result = await loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' });

			assert.deepEqual(documentTypesOf(result), ['mounted-configmap']);
			assert.equal(Object.keys(result.catalogs ?? {}).length, 1);
		});

		test('no catalogue id starts with a dot when a ConfigMap is mounted at the configs path', async () => {
			const root = makeDir();
			mountConfigMap(root, { 'base.json': JSON.stringify({ documentType: 'mounted-configmap' }) });

			const result = await loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' });

			assert.deepEqual(
				Object.keys(result.catalogs ?? {}).filter((catalogueId) => catalogueId.startsWith('.')),
				[],
			);
		});

		test('each catalogue mounted as its own ConfigMap is named after its folder', async () => {
			const root = makeDir();
			mountConfigMap(path.join(root, 'alpha'), {
				'base.json': JSON.stringify({ documentType: 'alpha-catalogue' }),
			});
			mountConfigMap(path.join(root, 'beta'), {
				'base.json': JSON.stringify({ documentType: 'beta-catalogue' }),
			});

			const result = await loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' });

			assert.deepEqual(Object.keys(result.catalogs ?? {}).sort(), ['alpha', 'beta']);
			assert.deepEqual(documentTypesOf(result).sort(), ['alpha-catalogue', 'beta-catalogue']);
		});

		test('a catalogue folder that is a symbolic link to a directory is loaded under the link name', async () => {
			const root = makeDir();
			const target = makeDir();
			writeJson(target, 'base.json', JSON.stringify({ documentType: 'linked-catalogue' }));
			fs.symlinkSync(path.relative(root, target), path.join(root, 'linked'), 'dir');

			const result = await loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' });

			assert.deepEqual(Object.keys(result.catalogs ?? {}), ['linked']);
			assert.deepEqual(documentTypesOf(result), ['linked-catalogue']);
		});

		/** Running as root, a directory with no permissions is still searchable, so the permission case cannot fail. */
		const runsAsRoot = process.getuid?.() === 0;

		/** Each skip warning's event, message and structured details, ordered by the entry it names. */
		type SkipWarning = { code?: string; entry: string; event: unknown; message: unknown; reason: string };
		const sortedByEntry = (warnings: unknown[][]): SkipWarning[] =>
			warnings
				.map(([event, message, details]) => ({
					event,
					message,
					...(details as Omit<SkipWarning, 'event' | 'message'>),
				}))
				.sort((a, b) => a.entry.localeCompare(b.entry));

		/** Runs `run` with console.warn captured, returning its result and each warning's arguments. */
		const warningsDuring = async <T>(run: () => Promise<T>) => {
			const warn = mock.method(console, 'warn', () => undefined);
			try {
				const result = await run();
				return { result, warnings: warn.mock.calls.map((call) => call.arguments) };
			} finally {
				warn.mock.restore();
			}
		};

		test('a dot-prefixed folder is skipped with a configs.entry_skipped warning naming it, while ordinary catalogues still load', async () => {
			const root = makeDir();
			fs.mkdirSync(path.join(root, '.hidden'));
			writeJson(path.join(root, '.hidden'), 'base.json', JSON.stringify({ documentType: 'hidden-folder' }));
			fs.mkdirSync(path.join(root, 'real'));
			writeJson(path.join(root, 'real'), 'base.json', JSON.stringify({ documentType: 'real-catalogue' }));

			const { result, warnings } = await warningsDuring(() =>
				loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
			);

			assert.deepEqual(Object.keys(result.catalogs ?? {}), ['real']);
			assert.deepEqual(documentTypesOf(result), ['real-catalogue']);
			assert.deepEqual(warnings, [
				[
					'configs.entry_skipped',
					`Skipped ".hidden" in the configs folder: a catalogue folder's name cannot start with a dot.`,
					{ entry: '.hidden', reason: 'dot_prefixed_folder' },
				],
			]);
		});

		test('the Kubernetes ..-prefixed entries of a ConfigMap mount produce no warning', async () => {
			const root = makeDir();
			mountConfigMap(root, { 'base.json': JSON.stringify({ documentType: 'mounted-configmap' }) });

			const { result, warnings } = await warningsDuring(() =>
				loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
			);

			assert.deepEqual(documentTypesOf(result), ['mounted-configmap']);
			assert.deepEqual(warnings, []);
		});

		test('a broken symbolic link is skipped with a configs.entry_skipped warning naming it, and the other catalogues still load', async () => {
			const root = makeDir();
			fs.mkdirSync(path.join(root, 'healthy'));
			writeJson(path.join(root, 'healthy'), 'base.json', JSON.stringify({ documentType: 'healthy-catalogue' }));
			fs.symlinkSync('missing-target', path.join(root, 'broken'));
			fs.symlinkSync('missing-target.json', path.join(root, 'stale.json'));

			const { result, warnings } = await warningsDuring(() =>
				loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
			);

			assert.deepEqual(Object.keys(result.catalogs ?? {}), ['healthy']);
			assert.deepEqual(documentTypesOf(result), ['healthy-catalogue']);
			assert.deepEqual(sortedByEntry(warnings), [
				{
					code: 'ENOENT',
					entry: 'broken',
					event: 'configs.entry_skipped',
					message:
						'Skipped "broken" in the configs folder: it no longer exists, or is a link to something that does not exist.',
					reason: 'unreadable',
				},
				{
					code: 'ENOENT',
					entry: 'stale.json',
					event: 'configs.entry_skipped',
					message:
						'Skipped "stale.json" in the configs folder: it no longer exists, or is a link to something that does not exist.',
					reason: 'unreadable',
				},
			]);
		});

		test(
			'an entry the server has no permission to reach is skipped with a warning saying so',
			{ skip: runsAsRoot && 'running as root can reach any entry' },
			async () => {
				const root = makeDir();
				const locked = makeDir();
				fs.mkdirSync(path.join(locked, 'inner'));
				fs.symlinkSync(path.relative(root, path.join(locked, 'inner')), path.join(root, 'linked-locked'));
				fs.chmodSync(locked, 0o000);

				try {
					const { warnings } = await warningsDuring(() =>
						loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
					);

					assert.deepEqual(sortedByEntry(warnings), [
						{
							code: 'EACCES',
							entry: 'linked-locked',
							event: 'configs.entry_skipped',
							message:
								'Skipped "linked-locked" in the configs folder: the server has no permission to reach it.',
							reason: 'unreadable',
						},
					]);
				} finally {
					fs.chmodSync(locked, 0o755);
				}
			},
		);

		test('an entry that cannot be reached for another reason is skipped with its error code in the warning', async () => {
			const root = makeDir();
			fs.symlinkSync('loop-b', path.join(root, 'loop-a'));
			fs.symlinkSync('loop-a', path.join(root, 'loop-b'));

			const { warnings } = await warningsDuring(() =>
				loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
			);

			assert.deepEqual(sortedByEntry(warnings), [
				{
					code: 'ELOOP',
					entry: 'loop-a',
					event: 'configs.entry_skipped',
					message: 'Skipped "loop-a" in the configs folder: it could not be reached (ELOOP).',
					reason: 'unreadable',
				},
				{
					code: 'ELOOP',
					entry: 'loop-b',
					event: 'configs.entry_skipped',
					message: 'Skipped "loop-b" in the configs folder: it could not be reached (ELOOP).',
					reason: 'unreadable',
				},
			]);
		});

		test('a top-level dot-prefixed .json file is read as a catalogue file, as it is today', async () => {
			const root = makeDir();
			writeJson(root, '.secret.json', JSON.stringify({ documentType: 'dot-file' }));

			const { result, warnings } = await warningsDuring(() =>
				loadAllConfigs({ catalogueConfigsPath: root, currentDirectory: '' }),
			);

			assert.deepEqual(documentTypesOf(result), ['dot-file']);
			assert.deepEqual(warnings, []);
		});
	});

	test('a malformed single-catalogue config fails loudly instead of silently defaulting to env values', async () => {
		const dir = makeDir();
		writeJson(dir, 'base.json', '{ not valid json');

		await assert.rejects(
			loadAllConfigs({
				catalogueConfigsPath: dir,
				currentDirectory: '',
			}),
		);
	});
});
