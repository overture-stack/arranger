import type { Request, RequestHandler } from 'express';

const BLOCKED_VARIABLE_KEYS = new Set(['filters', 'sqon']);

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const hasBlockedVariable = (value: unknown): boolean => {
	if (Array.isArray(value)) {
		return value.some(hasBlockedVariable);
	}

	if (!isObject(value)) {
		return false;
	}

	return Object.entries(value).some(([key, nestedValue]) => {
		const lowercaseKey = key.toLocaleLowerCase();
		if (BLOCKED_VARIABLE_KEYS.has(lowercaseKey) && nestedValue != null) {
			return true;
		}

		return hasBlockedVariable(nestedValue);
	});
};

const getVariablesFromRequest = (req: Request): unknown[] => {
	const requestVariables = [];
	const query = req.query || {};

	if (req.body && typeof req.body === 'object' && 'variables' in req.body) {
		requestVariables.push(req.body.variables);
	}

	if (typeof query.variables === 'string') {
		try {
			requestVariables.push(JSON.parse(query.variables));
		} catch {
			// Let Apollo report malformed variables payloads.
		}
	} else if (query.variables && typeof query.variables === 'object') {
		requestVariables.push(query.variables);
	}

	return requestVariables;
};

const rejectSqonWhenFiltersDisabled = (): RequestHandler => (req, res, next) => {
	const requestVariables = getVariablesFromRequest(req);

	if (requestVariables.some(hasBlockedVariable)) {
		return res.status(400).json({
			error: 'Filters are disabled for this server.',
		});
	}

	next();
};

export default rejectSqonWhenFiltersDisabled;
