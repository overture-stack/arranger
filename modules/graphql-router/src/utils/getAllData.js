import { PassThrough } from 'node:stream';

import { configRootProperties, downloadProperties } from '@overture-stack/arranger-types/configs/constants';

import fallbackConfigs from '#config/index.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';

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
	maxRows = null,
	mock,
	sort = [],
	sqon,
	...rest
}) => {
	const { configs, enableDebug, esClient, mockSchema, schema } = ctx;

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

	const esSort = sort.map(({ fieldName, order }) => ({ [fieldName]: order })).concat({ _id: 'asc' });

	const nestedFieldNames = configs.extendedFields
		.filter(({ type }) => type === 'nested')
		.map(({ fieldName }) => fieldName);

	const query = buildQuery({
		caller: 'getAllData',
		filters: sqon,
		nestedFieldNames,
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
		schema: mock ? mockSchema : schema,
		variables: { sqon },
	})
		.then(({ data }) => {
			enableDebug && console.debug('  DEBUG: runQuery completed, processing data...');

			const allowCustomMaxRows =
				configs.config[configRootProperties.DOWNLOADS][downloadProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS];
			const maxHits = allowCustomMaxRows
				? maxRows || configs.config[downloadProperties.MAX_DOWNLOAD_ROWS]
				: configs.config[downloadProperties.MAX_DOWNLOAD_ROWS];

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

				const writeResult = stream.write({ hits: hits.map((hit) => hit?._source), total }, (err) => {
					if (err) {
						console.error(`Write callback error in step ${stepNumber + 1}:`, err);
					} else {
						enableDebug && console.debug(`  DEBUG: Write callback completed for step ${stepNumber + 1}`);
					}
				});

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
