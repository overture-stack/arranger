import { deprecate } from 'node:util';

import type { RequestHandler, Response } from 'express';

import { MIGRATION_GUIDE_URL } from './migrationGuide.js';

/**
 * What a router keeps about one request under `res.locals.arranger`: its catalogue configuration,
 * search client, schema, debug flag and access-control decision, plus any key an application writes
 * through the deprecated `req.context`.
 */
export type ArrangerLocals = Record<PropertyKey, unknown>;

declare module 'express-serve-static-core' {
	interface Locals {
		/** Arranger's per-request state. Read it through `res.locals`; `req.context` is a deprecated view of it. */
		arranger?: ArrangerLocals;
	}
}

/** The `res.locals` key Arranger keeps its own per-request state under. */
export const ARRANGER_LOCALS_KEY = 'arranger';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

/** Where the migration guide explains the move from `req.context` to `res.locals`, pinned as the guide's own link is. */
export const REQUEST_STATE_MIGRATION_URL = `${MIGRATION_GUIDE_URL}#per-request-state-res-locals`;

/** Emits one `DeprecationWarning` per process, however many requests use `req.context`. */
const warnRequestContextDeprecated = deprecate(
	() => undefined,
	`req.context is deprecated: Arranger keeps per-request state in res.locals, its own keys under res.locals.${ARRANGER_LOCALS_KEY}. See ${REQUEST_STATE_MIGRATION_URL}`,
	'ARRANGER_REQ_CONTEXT',
);

/**
 * The request's Arranger namespace, created on first use. It stays one object for the whole request,
 * which is what keeps a write through `req.context` visible in `res.locals.arranger` and the reverse.
 */
export const arrangerLocalsOf = (res: Response): ArrangerLocals => {
	res.locals[ARRANGER_LOCALS_KEY] ??= {};

	return res.locals[ARRANGER_LOCALS_KEY];
};

/** Returns middleware that merges `patch` into the request's Arranger namespace, its keys replacing any already there. */
export const addArrangerLocals = (patch: ArrangerLocals): RequestHandler => {
	return (_req, res, next) => {
		Object.assign(arrangerLocalsOf(res), patch);
		next();
	};
};

/**
 * Middleware keeping `req.context` as a deprecated view of the request's Arranger namespace. A plain `req.context` an application set before the router is folded into the
 * namespace first, symbol keys included. Reading it returns the namespace itself; assigning an object
 * merges that object's keys into it.
 */
export const keepRequestContextView: RequestHandler = (req, res, next) => {
	const descriptor = Object.getOwnPropertyDescriptor(req, 'context');

	if (!descriptor?.get) {
		const namespace = arrangerLocalsOf(res);

		if (isRecord(descriptor?.value)) {
			warnRequestContextDeprecated();
			Object.assign(namespace, descriptor.value);
		}

		Object.defineProperty(req, 'context', {
			configurable: true,
			enumerable: true,
			get: () => {
				warnRequestContextDeprecated();
				return namespace;
			},
			set: (value: unknown) => {
				warnRequestContextDeprecated();
				if (isRecord(value)) {
					Object.assign(namespace, value);
				}
			},
		});
	}

	next();
};

/**
 * What a server-side filter callback receives from the request: the application's own `res.locals`
 * keys, then Arranger's namespace, whose keys take precedence. Accepts `res.locals` itself, or a
 * context an application assembled some other way, which it returns unchanged.
 */
export const requestStateOf = (context: unknown): Record<PropertyKey, unknown> => {
	if (!isRecord(context)) {
		return {};
	}

	const { [ARRANGER_LOCALS_KEY]: arranger, ...applicationLocals } = context;

	return isRecord(arranger) ? { ...applicationLocals, ...arranger } : context;
};

/**
 * What an export runs under: the state `requestStateOf` gives, carrying the request's own store as
 * `locals`, so a filter callback reads it there as on a GraphQL read. Accepts `res.locals` itself, or a
 * context already carrying `locals`, which keeps its own.
 *
 * @param context `res.locals`, or a context assembled for the export.
 */
export const exportStateOf = (context: unknown): Record<PropertyKey, unknown> => {
	const state = requestStateOf(context);

	return isRecord(context) && !('locals' in state) ? { ...state, locals: context } : state;
};

/**
 * Returns middleware that merges `patch` into the request context.
 *
 * @deprecated Write to `res.locals` instead. `req.context` is a view of `res.locals.arranger`.
 */
export const addContext = (patch: ArrangerLocals): RequestHandler => {
	return (req, _res, next) => {
		const current: unknown = Reflect.get(req, 'context');
		Reflect.set(req, 'context', { ...(isRecord(current) ? current : {}), ...patch });
		next();
	};
};
