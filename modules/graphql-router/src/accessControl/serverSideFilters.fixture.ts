import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { SqonBuilder } from '@overture-stack/sqon';

import getDefaultServerSideFilter from './getDefaultServerSideFilter.js';

/*
 * Server-side filter callbacks for tests: allow everything, restrict to some records, deny
 * everything.
 *
 * A test whose filter permits every record passes whether or not the filter reaches the query, so
 * it cannot detect a read path that drops it. Asserting that enforcement works needs
 * `restrictingFilter`.
 */

/**
 * Permits every document. Cannot demonstrate enforcement, because its result is the same as the
 * filter never having been composed.
 */
export const allowAllFilter: GetServerSideFilterFn<unknown> = getDefaultServerSideFilter;

/**
 * Permits only records whose `fieldName` holds one of `values`.
 *
 * Composed into a query this changes the result, so an assertion on that result fails if the filter
 * is dropped anywhere between the callback and Elasticsearch.
 *
 * @param fieldName the record field the permitted values are matched against.
 * @param values the values a record may hold to be visible; every other record is excluded.
 */
export const restrictingFilter = ({
	fieldName,
	values,
}: {
	fieldName: string;
	values: string[];
}): GetServerSideFilterFn<unknown> => () => ({
	op: 'in',
	content: { fieldName, value: values },
});

/**
 * Denies every document.
 *
 * Built through `matchNothing` rather than as a literal: an `in` with an empty value list is the
 * only encoding of "restrict to nothing" that survives filter reduction, and a hand-written
 * `{ value: [] }` invites a tidy-up into one of the fail-open forms.
 *
 * @param fieldName mechanical rather than meaningful: an empty value list matches nothing whatever
 *   field it names, including one absent from the mapping.
 */
export const denyAllFilter = (fieldName: string): GetServerSideFilterFn<unknown> => () =>
	SqonBuilder.matchNothing(fieldName).toValue();

/**
 * The two-clause shape a derived artifact needs: permitted resources, plus a ceiling excluding any
 * record whose recorded provenance names a withheld one.
 *
 * The second clause is negative by necessity, since containment of a multi-valued provenance in the
 * permitted set is not expressible against a flat keyword array while disjointness from its
 * complement is. That makes it the one clause where a polarity error is silent: emitted under
 * `must` instead of `must_not` it selects exactly the records it should exclude.
 *
 * @param permitted resource values the principal holds, matched positively.
 * @param provenanceField the field recording which resources contributed to a derived record.
 * @param resourceField the field attributing a record to a single resource.
 * @param withheld the complement: configured resources the principal does not hold.
 */
export const provenanceCeilingFilter = ({
	permitted,
	provenanceField,
	resourceField,
	withheld,
}: {
	permitted: string[];
	provenanceField: string;
	resourceField: string;
	withheld: string[];
}): GetServerSideFilterFn<unknown> => () => ({
	op: 'and',
	content: [
		{ op: 'in', content: { fieldName: resourceField, value: permitted } },
		{ op: 'not-in', content: { fieldName: provenanceField, value: withheld } },
	],
});
