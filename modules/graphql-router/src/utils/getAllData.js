import { PassThrough } from 'node:stream';

import { configOptionalProperties, configRootProperties, downloadProperties } from '@overture-stack/arranger-types/configs/constants';

import fallbackConfigs from '#config/index.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';
import compileFilter from '#mapping/utils/compileFilter.js';
import { applyNestingPrefix, unwrapSource } from '#middleware/utils/nestingPrefix.js';

import runQuery from './runQuery.js';

/**
 * @param maxRows (Optional. Default: null) Limits the maximum number of rows to include in the results.
 *
 * If zero (0) is given, it will include up to Server's own limit (Default: 100).
 * This props may be ignored depending on Server configs.
 */
export default async ({
	chunkSize = fallbackConfigs.downloads.chunkSize,
	columns = [],
	ctx = {},
	getServerSideFilter,
	maxRows = null,
	sort = [],
	sqon,
	...rest
}) => {
	const { configs, enableDebug, esClient, schema } = ctx;
	const nestingPrefix = configs.config?.[configOptionalProperties.NESTING_PREFIX];

	// TODO: review what "configs" come in here, trim down to what's relevant in this context

	const stream = new PassThrough({ objectMode: true });

	if (enableDebug) {
		stream.on('error', (err) => console.error('STREAM ERROR:', err));
		stream.on('close', () => console.log('STREAM CLOSED'));
		stream.on('finish', () => console.log('STREAM FINISHED'));
		stream.on('end', () => console.log('STREAM ENDED'));
		stream.on('pipe', () => console.log('STREAM PIPED'));
		stream.on('unpipe', () => console.log('STREAM UNPIPED'));
	}

	const esSort = sort
		.map(({ fieldName, order }) => ({ [applyNestingPrefix(fieldName, nestingPrefix)]: order }))
		.concat({ _id: 'asc' });

	// From the mapping, like every other call site, rather than from `extendedFields`: nesting is an
	// index-mapping fact, and `extendedFields` falls back to raw file config whenever extending the
	// mapping throws, including when a catalogue simply has no `extended.json`. A missing entry here
	// compiles a nested filter flat, which matches nothing: no rows for a positive clause, and every
	// document for a negated one.
	//
	// Guarded rather than defaulted, because `buildQuery` defaults this argument to `[]`: a `configs`
	// that never went through `addMappingsToTypes` would otherwise reach the compiler and emit exactly
	// the filter this fix removes, with nothing raised. Absent is a wiring fault, not "nothing nested".
	if (!Array.isArray(configs.nested_fieldNames)) {
		throw new Error(
			`Cannot build a download query for "${configs.name}": its configs carry no \`nested_fieldNames\`. ` +
				'That list comes from the index mapping via `addMappingsToTypes`, and without it every filter on a ' +
				'nested field compiles flat, returning no rows for a positive clause and every row for a negated one.',
		);
	}

	const nestedFieldNames = configs.nested_fieldNames;

	// Export is a read path like any other, so the access-control filter has to be composed here
	// too. Without this the caller's SQON reaches Elasticsearch alone and the export returns every
	// document the query matches, whatever the deployment's filter says.
	const query = buildQuery({
		caller: 'getAllData',
		filters: compileFilter({
			clientSideFilter: sqon,
			disableClientFilters: configs.config?.[configOptionalProperties.DISABLE_FILTERS] ?? false,
			serverSideFilter: getServerSideFilter?.(ctx),
		}),
		nestedFieldNames,
		nestingPrefix,
	});

	runQuery({
		esClient,
		query: `
        query ($sqon: JSON) {
          ${configs.name} {
            hits(filters: $sqon) {
              total
            }
          }
        }
      `,
		schema,
		variables: { sqon },
	})
		.then(({ data }) => {
			enableDebug && console.debug('  DEBUG: runQuery completed, processing data...');

			const allowCustomMaxRows =
				configs.config[configRootProperties.DOWNLOADS][downloadProperties.ALLOW_CUSTOM_MAX_ROWS];
			const maxHits = allowCustomMaxRows
				? maxRows || configs.config[configRootProperties.DOWNLOADS][downloadProperties.MAX_ROWS]
				: configs.config[configRootProperties.DOWNLOADS][downloadProperties.MAX_ROWS];

			const hitsCount = data?.[configs.name]?.hits?.total || 0;
			const total = maxHits ? Math.min(hitsCount, maxHits) : hitsCount; // i.e. 'maxHits == 0' => hitCounts
			const steps = Array(Math.ceil(total / chunkSize)).fill(null);

			enableDebug &&
				console.debug(
					`  DEBUG: Total hits: ${hitsCount}, Max hits: ${maxHits}, Total to fetch: ${total}, Steps: ${steps.length}`,
				);

			// async reduce because each cycle is dependent on result of the previous
			return steps.reduce(async (previous, next, stepNumber) => {
				const previousHits = await previous;
				const timerLabel = `EsQuery, step ${stepNumber + 1}/${steps.length}`;

				if (enableDebug) {
					console.log(`\n=== STEP ${stepNumber + 1}/${steps.length} ===`);
					console.time(timerLabel);
				}

				const hits = await esClient
					.search({
						index: configs.index,
						size: maxHits ? Math.min(maxHits, chunkSize) : chunkSize,
						body: {
							sort: esSort,
							...(previousHits
								? {
										search_after:
											previousHits[previousHits.length - 1]?.sort?.map(isESValueSafeJSInt),
									}
								: {}),
							...(Object.entries(query).length ? { query } : {}),
						},
					})
					.then(({ body }) => body.hits.hits);

				if (enableDebug) {
					console.timeEnd(timerLabel);
					console.log(`Fetched ${hits.length} hits in step ${stepNumber + 1}`);
					console.log(`Stream writable: ${stream.writable}, destroyed: ${stream.destroyed}`);
				}

				const writeResult = stream.write(
					{ hits: hits.map((hit) => unwrapSource(hit?._source, nestingPrefix)), total },
					(err) => {
						if (err) {
							console.error(`Write callback error in step ${stepNumber + 1}:`, err);
						} else {
							enableDebug && console.debug(`  DEBUG: Write callback completed for step ${stepNumber + 1}`);
						}
					},
				);

				enableDebug && console.debug(`  DEBUG: Write returned: ${writeResult} (false = backpressure)`);

				return hits;
			}, Promise.resolve());
		})
		.then((finalHits) => {
			console.log('\n=== REDUCE COMPLETE ===');
			console.log('Final hits length:', finalHits?.length);
			console.log('Stream writable before end:', stream.writable);
			console.log('Stream destroyed before end:', stream.destroyed);

			stream.end();
			console.log('stream.end() called');
		})
		.catch((err) => {
			console.error('ERROR in getAllData:', err);
			stream.destroy(err);
		});

	enableDebug && console.debug('  DEBUG: getAllData: Returning stream');

	return stream;
};
