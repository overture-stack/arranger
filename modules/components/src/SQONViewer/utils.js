/* @flow */
import { parseSQONParam } from '../utils/uri';

// import type {
//   TValueContent,
//   TValueSQON,
//   TGroupContent,
//   TGroupSQON,
//   TMergeSQON,
//   TCombineValues,
//   TMergeFns,
//   TMergeQuery,
//   TSortSQON,
//   TFilterByAllowlist,
//   TRemoveSQON,
// } from './types';

function compareTerms(a, b) {
	return (
		a.op.toLowerCase() === b.op.toLowerCase() &&
		(a.content.fieldName
			? a.content.fieldName === b.content.fieldName
			: a.content.entity === b.content.entity)
	);
}

// const sortSQON: TSortSQON = (a, b) => {
const sortSQON = (a, b) => {
	if (a.content.fieldName && b.content.fieldName) {
		return a.content.fieldName.localeCompare(b.content.fieldName);
	} else if (a.content.fieldName || b.content.fieldName) {
		return a.content.fieldName ? -1 : 1;
	} else {
		return 0;
	}
};

// export const combineValues: TCombineValues = (x, y) => {
export const combineValues = (x, y) => {
	const xValue = [].concat(x.content.value || []);
	const yValue = [].concat(y.content.value || []);

	if (xValue.length === 0 && yValue.length === 0) return null;
	if (xValue.length === 0) return y;
	if (yValue.length === 0) return x;

	const merged = {
		op: x.op,
		content: {
			fieldName: x.content.fieldName,
			value: xValue
				.reduce((acc, v) => {
					if (acc.includes(v)) return acc.filter((f) => f !== v);
					return [...acc, v];
				}, yValue)
				.sort(),
		},
	};

	return merged.content.value.length ? merged : null;
};

// export const addInValue: TCombineValues = (x, y) => {
export const addInValue = (x, y) => {
	const xValue = [].concat(x.content.value || []);
	const yValue = [].concat(y.content.value || []);

	if (xValue.length === 0 && yValue.length === 0) return null;
	if (xValue.length === 0) return y;
	if (yValue.length === 0) return x;

	const merged = {
		op: 'in',
		content: {
			fieldName: x.content.fieldName,
			value: xValue
				.reduce((acc, v) => {
					if (acc.includes(v)) return acc;
					return [...acc, v];
				}, yValue)
				.sort(),
		},
	};

	return merged.content.value.length ? merged : null;
};

// export const toggleSQON: TMergeSQON = (q, ctxq) => {
export const toggleSQON = (q, ctxq) => {
	if (!ctxq && !q) return null;
	if (!ctxq) return q;
	if (!q) return ctxq;

	const merged = {
		op: 'and',
		content: ctxq.content
			.reduce((acc, ctx) => {
				const found = acc.find((a) => compareTerms(a, ctx));
				if (!found) return [...acc, ctx];
				return [...acc.filter((y) => !compareTerms(y, found)), combineValues(found, ctx)].filter(
					Boolean,
				);
			}, q.content)
			.sort(sortSQON),
	};

	return merged.content.length ? merged : null;
};

// export const replaceSQON: TMergeSQON = (q, ctxq) => {
export const replaceSQON = (q, ctxq) => {
	if (!ctxq && !q) return null;
	if (!ctxq) return q;
	if (!q) return ctxq;

	const merged = {
		op: 'and',
		content: ctxq.content
			.reduce((acc, ctx) => {
				const found = acc.find((a) => compareTerms(a, ctx));
				if (!found) return [...acc, ctx];
				return acc;
			}, q.content)
			.sort(sortSQON),
	};

	return merged.content.length ? merged : null;
};

// export const addInSQON: TMergeSQON = (q, ctxq) => {
export const addInSQON = (q, ctxq) => {
	if (!ctxq && !q) return null;
	if (!ctxq) return q;
	if (!q) return ctxq;

	const merged = {
		op: 'and',
		content: ctxq.content
			.reduce((acc, ctx) => {
				const found = acc.find((a) => compareTerms(a, ctx));
				if (!found) return [...acc, ctx];
				return [
					...acc.filter((y) => y.content.fieldName !== found.content.fieldName),
					addInValue(found, ctx),
				].filter(Boolean);
			}, q.content)
			.sort(sortSQON),
	};

	return merged.content.length ? merged : null;
};

// export const replaceFieldSQON: TMergeSQON = (fieldName, q, ctxq) => {
export const replaceFieldSQON = (fieldName, q, ctxq) => {
	if (!ctxq && !q) return null;
	if (!ctxq) return q;
	if (!q) return ctxq;

	const merged = {
		op: 'and',
		content: ctxq.content
			.filter((condition) => condition?.content?.fieldName !== fieldName)
			.concat(q?.content || [])
			.sort(sortSQON),
	};

	return merged.content.length ? merged : null;
};

// export const replaceFilterSQON: TMergeSQON = (q, ctxq) => {
export const replaceFilterSQON = (q, ctxq) => {
	const { entity, fieldNames, value } = q?.content?.[0]?.content || {};
	const merged = {
		op: 'and',
		content: [
			...(ctxq?.content?.filter((x) =>
				entity ? !(x.op === 'filter' && x.content.entity === entity) : x.op !== 'filter',
			) || []),
			...(!fieldNames?.length || !value?.length ? [] : q.content),
		].sort(sortSQON),
	};
	return merged.content.length ? merged : null;
};

export const currentFilterValue = (sqon, entity = null) =>
	sqon?.content?.find(
		({ op, content }) => op === 'filter' && (!entity || entity === content.entity),
	)?.content?.value || '';

// const mergeFns: TMergeFns = (v) => {
const mergeFns = (v) => {
	switch (v) {
		case 'toggle':
			return toggleSQON;
		case 'add':
			return addInSQON;
		default:
			return replaceSQON;
	}
};

// const filterByAllowlist: TFilterByAllowlist = (obj, wls) =>
const filterByAllowlist = (obj, wls) =>
	Object.keys(obj || {}).reduce((acc, k) => (wls.includes(k) ? { ...acc, [k]: obj[k] } : acc), {});

// export const mergeQuery: TMergeQuery = (q, c, mergeType, allowlist) => {
export const mergeQuery = (q, c, mergeType, allowlist) => {
	const ctx = c || {};
	const query = q || {};
	const wlCtx = allowlist ? filterByAllowlist(ctx, allowlist) : ctx;

	// const mQs: Object = {
	const mQs = {
		...wlCtx,
		...query,
	};

	return {
		...mQs,
		sqon: mergeFns(mergeType)(query.sqon, parseSQONParam(wlCtx.sqon, null)),
	};
};

// export const setSQON = ({ value, field }: TValueContent) => ({
export const setSQON = ({ value, fieldName }) => ({
	op: 'and',
	content: [
		{
			op: 'in',
			content: { fieldName, value: [].concat(value || []) },
		},
	],
});

// export const setSQONContent = (sqonContent: Array<TValueSQON>): ?TGroupSQON =>
export const setSQONContent = (sqonContent) =>
	sqonContent.length
		? {
				op: 'and',
				content: sqonContent,
		  }
		: null;

// returns current value for a given field / operation
export const currentFieldValue = ({ sqon, dotFieldName, op }) =>
	sqon?.content?.find((content) => content.content?.fieldName === dotFieldName && content.op === op)
		?.content.value;

// true if field and value in
export const inCurrentSQON = ({
	currentSQON,
	value,
	dotFieldName,
	// }: {
	//   currentSQON: TGroupSQON,
	//   dotFieldName: string,
	//   value: string,
	// }): boolean => {
}) => {
	const content = currentSQON?.content;
	return (Array.isArray(content) ? content : [].concat(currentSQON || [])).some(
		(f) =>
			f.content?.fieldName === dotFieldName && [].concat(f.content.value || []).includes(value),
	);
};

// true if field in
export const fieldInCurrentSQON = ({
	currentSQON = [],
	fieldName,
	// }: {
	//   currentSQON: TGroupContent,
	//   fieldName: string,
}) => {
	return currentSQON.some((f) => f?.content?.fieldName === fieldName);
};

export const getSQONValue = ({
	currentSQON,
	dotFieldName,
	// }: {
	//   currentSQON: TGroupContent,
	// dotFieldName: string,
}) => currentSQON.find((f) => f.content.fieldName === dotFieldName);

// type TMakeSQON = (fields: [{ fieldName: string, value: string }]) => Object | string;
// export const makeSQON: TMakeSQON = (fields) => {
export const makeSQON = (fields) => {
	if (!fields.length) return {};
	return {
		op: 'and',
		content: fields.map((field) => {
			return {
				op: 'in',
				content: {
					fieldName: field.fieldName,
					value: [].concat(field.value || []),
				},
			};
		}),
	};
};

// export const removeSQON: TRemoveSQON = (fieldName, sqon) => {
export const removeSQON = (fieldName, sqon) => {
	if (!sqon) return null;
	if (!fieldName) return sqon;
	if (Object.keys(sqon).length === 0) return sqon;

	if (!Array.isArray(sqon.content)) {
		const fieldFilter =
			typeof fieldName === 'function' ? fieldName : (input) => input === fieldName;
		return fieldFilter(sqon.content.fieldName) ? null : sqon;
	}

	const filteredContent = sqon.content.map((q) => removeSQON(fieldName, q)).filter(Boolean);

	return filteredContent.length
		? {
				...sqon,
				content: filteredContent,
		  }
		: null;
};

export default makeSQON;
