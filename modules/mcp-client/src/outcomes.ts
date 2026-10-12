import {
	ProtocolError,
	ProtocolErrorCode,
	SdkError,
	SdkErrorCode,
	SdkHttpError,
	UnauthorizedError,
} from '@modelcontextprotocol/client';

import { isRecord } from './json.js';

/**
 * Why a request leg got no usable answer.
 *
 * @remarks
 * - `timeout`: the leg's timer ran out, and the caller did not abort.
 * - `http`: the server answered with an HTTP error status.
 * - `unauthorized`: authentication failed, including after an `AuthProvider` retry.
 * - `closed`: the connection closed while the leg was in flight.
 * - `network`: `fetch` failed.
 * - `invalid_result`: the reply failed the SDK's wire codec, so whether the tool ran is unknown.
 * - `not_connected`: the client was not connected.
 * - `unknown`: anything else, including an unexpected error inside this client.
 */
export type TransportErrorKind =
	| 'timeout'
	| 'http'
	| 'unauthorized'
	| 'closed'
	| 'network'
	| 'invalid_result'
	| 'not_connected'
	| 'unknown';

/** The tool ran, including a result with `isError: true`. */
export type ResultOutcome<T> = { outcome: 'result'; result: T };

/** The tool ran, but its `structuredContent` failed the tool's `outputSchema`, or that schema does not compile. */
export type OutputInvalidOutcome<T> = { outcome: 'output_invalid'; result: T; message: string };

/** The server answered with a JSON-RPC error. */
export type RejectedOutcome = { outcome: 'rejected'; code: number; message: string; data?: unknown };

/** The server refused the echoed `requestState`, so the call did not run. */
export type InputStateRejectedOutcome = {
	outcome: 'input_state_rejected';
	message: string;
	/** How long the refused round's questions waited. */
	waitedMs: number;
};

/** The client could not answer the server's questions, so the call did not run. */
export type InputFailedOutcome =
	| {
			outcome: 'input_failed';
			/** The server asked for something other than a form, or no resolver is configured. */
			reason: 'unsupported_request';
			key: string;
			method: string;
			message: string;
	  }
	| {
			outcome: 'input_failed';
			/** The resolver, or `onRound`, threw. */
			reason: 'resolver_error';
			message: string;
	  };

/** The server was still asking after `maxRounds` retries. */
export type RoundsExceededOutcome = { outcome: 'rounds_exceeded'; maxRounds: number };

/** The caller's signal aborted the call. */
export type CancelledOutcome = { outcome: 'cancelled' };

/** A request leg got no usable answer. */
export type TransportErrorOutcome = {
	outcome: 'transport_error';
	kind: TransportErrorKind;
	message: string;
	/** The HTTP status, for `kind: 'http'` and some `unauthorized` errors. */
	status?: number;
	/** The SDK's error code, when the SDK raised the error. */
	sdkCode?: string;
};

/** How a call ended, apart from its timing. Plain data, so it can be sent as an event unchanged. */
export type OutcomeFields<T> =
	| ResultOutcome<T>
	| OutputInvalidOutcome<T>
	| RejectedOutcome
	| InputStateRejectedOutcome
	| InputFailedOutcome
	| RoundsExceededOutcome
	| CancelledOutcome
	| TransportErrorOutcome;

/** Where a call's time went. */
export type CallTiming = {
	/** Time not spent in the resolver, including the pause before a round without questions. */
	wireMs: number;
	/** Time spent in the resolver. */
	waitingMs: number;
	/** How many `input_required` rounds the server sent. */
	rounds: number;
};

/** What every call resolves with. Calls never throw. */
export type CallOutcome<T> = OutcomeFields<T> & CallTiming;

/** What {@link classifyError} needs to know about the failed leg. */
export type ClassifyContext = {
	/** Whether the caller's signal has aborted, since the SDK reports an abort like a timeout. */
	aborted: boolean;
	/** Whether the failed leg echoed a `requestState`. */
	carriedRequestState: boolean;
	/** How long the last round waited for answers. */
	waitedMs: number;
};

/** The message of an `Error`, or the thrown value as a string. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const transportKind = (error: SdkError): TransportErrorKind => {
	switch (error.code) {
		case SdkErrorCode.RequestTimeout:
			return 'timeout';
		case SdkErrorCode.ConnectionClosed:
			return 'closed';
		case SdkErrorCode.InvalidResult:
			return 'invalid_result';
		case SdkErrorCode.NotConnected:
			return 'not_connected';
		case SdkErrorCode.ClientHttpAuthentication:
		case SdkErrorCode.ClientHttpForbidden:
			return 'unauthorized';
		default:
			return error instanceof SdkHttpError ? 'http' : 'unknown';
	}
};

/**
 * Turns whatever a request leg threw into an outcome.
 *
 * @param error - What the SDK threw.
 * @param context - The state of the call when it threw.
 * @returns `cancelled` whenever the caller aborted; otherwise the outcome the error indicates.
 */
export const classifyError = (error: unknown, context: ClassifyContext): OutcomeFields<never> => {
	if (context.aborted) {
		return { outcome: 'cancelled' };
	}

	if (error instanceof ProtocolError) {
		if (
			context.carriedRequestState &&
			error.code === ProtocolErrorCode.InvalidParams &&
			isRecord(error.data) &&
			error.data.reason === 'invalid_request_state'
		) {
			return { outcome: 'input_state_rejected', message: error.message, waitedMs: context.waitedMs };
		}
		return {
			outcome: 'rejected',
			code: error.code,
			message: error.message,
			...(error.data !== undefined && { data: error.data }),
		};
	}

	if (error instanceof UnauthorizedError) {
		return { outcome: 'transport_error', kind: 'unauthorized', message: error.message };
	}

	if (error instanceof SdkError) {
		return {
			outcome: 'transport_error',
			kind: transportKind(error),
			message: error.message,
			sdkCode: error.code,
			...(error instanceof SdkHttpError && { status: error.status }),
		};
	}

	// The SDK passes a failed `fetch` through unwrapped, and rejects before `connect` with a plain Error.
	if (error instanceof TypeError) {
		return { outcome: 'transport_error', kind: 'network', message: error.message };
	}
	if (error instanceof Error && error.message === 'Not connected') {
		return { outcome: 'transport_error', kind: 'not_connected', message: error.message };
	}

	return { outcome: 'transport_error', kind: 'unknown', message: errorMessage(error) };
};
