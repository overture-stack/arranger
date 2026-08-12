#!/usr/bin/env node
/**
 * Rewrites field-path references across a catalogue's extended.json/facets.json/table.json
 * when the underlying ES/OS mapping renames or re-nests a set of fields, e.g. an upstream
 * indexing pipeline change that pluralizes an entity name or moves it under a new parent.
 * Regenerates table.json's jsonPath/query from each new fieldName rather than patching the
 * old ones, so the three files stay internally consistent with each other.
 *
 * The prefix map only ever rewrites a fieldName's leading path segment; anything after it
 * (including further nesting, like an existing sub-entity) is carried through unchanged.
 *
 * Usage: node scripts/remap-catalogue-fields.mjs <config-dir> <prefix-map.json>
 *
 * <prefix-map.json>: { "oldTopLevelSegment": ["new", "path", "segments"], ... }
 * Example: { "specimen": ["primary_diagnoses", "specimens"] } rewrites `specimen.tumour_grade`
 * to `primary_diagnoses.specimens.tumour_grade` everywhere it appears.
 *
 * Doesn't touch base.json (nestingPrefix, if any, is a separate, unaffected envelope concern)
 * or validate the new paths against a live mapping: cross-check the result yourself against
 * the actual target index before deploying, e.g. by diffing against `_mapping`'s real fields.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [configDir, prefixMapPath] = process.argv.slice(2);

if (!configDir || !prefixMapPath) {
	console.error('Usage: node scripts/remap-catalogue-fields.mjs <config-dir> <prefix-map.json>');
	process.exit(1);
}

const prefixMap = JSON.parse(readFileSync(resolve(prefixMapPath), 'utf8'));

const remapSegments = (segments) => {
	const [first, ...rest] = segments;
	return prefixMap[first] ? [...prefixMap[first], ...rest] : segments;
};

const remapFieldName = (fieldName, separator) => remapSegments(fieldName.split(separator)).join(separator);

/** Regenerates table.json's jsonPath/query from a dotted fieldName, matching Arranger's own hits.edges.node connection shape at every nested level. */
const buildJsonPathAndQuery = (fieldName) => {
	const segments = fieldName.split('.');
	const nested = segments.slice(0, -1);
	const leaf = segments.at(-1);

	const jsonPath = `$.${nested.map((seg) => `${seg}.hits.edges[*].node.`).join('')}${leaf}`;
	const opening = nested.map((seg) => `${seg} { hits { edges { node { `).join('');
	const closing = nested.length ? ` ${Array(4 * nested.length).fill('}').join(' ')}` : '';
	const query = `${opening}${leaf}${closing}`;

	return { jsonPath, query };
};

const rewriteFile = (relativePath, { getEntries, separator, isTable = false }) => {
	const path = resolve(configDir, relativePath);
	const data = JSON.parse(readFileSync(path, 'utf8'));
	let count = 0;

	for (const entry of getEntries(data)) {
		const remapped = remapFieldName(entry.fieldName, separator);
		if (remapped === entry.fieldName) continue;

		entry.fieldName = remapped;
		if (isTable) Object.assign(entry, buildJsonPathAndQuery(remapped));
		count++;
	}

	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
	console.log(`${relativePath}: ${count} fieldName(s) remapped`);
};

rewriteFile('extended.json', { getEntries: (data) => data.extended, separator: '.' });
rewriteFile('facets.json', { getEntries: (data) => data.facets.aggregations, separator: '__' });
rewriteFile('table.json', { getEntries: (data) => data.table.columns, separator: '.', isTable: true });
