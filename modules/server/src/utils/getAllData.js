import { PassThrough } from 'stream';

import { ENV_CONFIG } from '#config/index.js';
import { configProperties } from '#config/types.js';
import { mapHits } from '#mapping/index.js';
import { buildQuery, isESValueSafeJSInt } from '#middleware/index.js';

import runQuery from './runQuery.js';

/**
 * @param maxRows (Optional. Default: null) Limits the maximum number of rows to include in the results.
 *
 * If zero (0) is given, it will include up to Server's own limit (Default: 100).
 * -- This props may be ignored depending on Server configs.
 */
export default async ({
	chunkSize = ENV_CONFIG.DOWNLOAD_STREAM_BUFFER_SIZE,
	columns = [],
	ctx = {},
	maxRows,
	mock,
	sort = [],
	sqon,
	...rest
}) => {
	const { configs, esClient, mockSchema, schema } = ctx;

	const stream = new PassThrough({ objectMode: true });
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
			const allowCustomMaxRows =
				configs.config[configProperties.DOWNLOADS][configProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS];
			const maxHits = allowCustomMaxRows
				? maxRows || configs.config[configProperties.MAX_DOWNLOAD_ROWS]
				: configs.config[configProperties.MAX_DOWNLOAD_ROWS];

			const hitsCount = data?.[configs.name]?.hits?.total || 0;
			const total = maxHits ? Math.min(hitsCount, maxHits) : hitsCount; // i.e. 'maxHits == 0' => hitCounts
			const steps = Array(Math.ceil(total / chunkSize)).fill(null);

			// async reduce because each cycle is dependent on result of the previous
			return steps.reduce(async (previous, next, stepNumber) => {
				const previousHits = await previous;
				const timerLabel = `EsQuery, step ${stepNumber + 1}`;

				console.time(timerLabel);
				const hits = await esClient
					.search({
						index: configs.index,
						size: maxHits ? Math.min(maxHits, chunkSize) : chunkSize,
						body: {
							sort: esSort,
							...(previousHits
								? {
									search_after: previousHits[previousHits.length - 1]?.sort?.map(isESValueSafeJSInt),
								}
								: {}),
							...(Object.entries(query).length ? { query } : {}),
						},
					})
					.then(({ body }) => body.hits.hits);
				console.timeEnd(timerLabel);

				stream.write({ hits: hits.map((hit) => hit?._source), total });

				return hits;
			}, Promise.resolve());
		})
		.then(() => stream.end())
		.catch((err) => {
			console.error('error', err);
		});

	return stream;
};
