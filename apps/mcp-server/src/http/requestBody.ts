import { type IncomingMessage } from 'node:http';

/** Why a body was refused, and the answer to send. */
export type RequestBodyRefusal = { status: number; code: number; message: string };

/**
 * Outcome of reading a request body.
 *
 * `refusal` is set when the request must be answered rather than served. Otherwise `body` is the
 * parsed JSON value to hand the MCP handler, or `undefined` when there was nothing to parse (a
 * body-less method, or an empty payload). `undefined` is the same value `toNodeHandler` treats as
 * "no pre-parsed body", and it is safe to pass after the stream has been drained: the adapter finds
 * an exhausted stream and reads nothing.
 */
export type RequestBodyResult = { body?: unknown; refusal?: RequestBodyRefusal };

/** JSON-RPC parse error, the answer for a body that is not valid JSON. */
const PARSE_ERROR = -32700;

/** Applied to a body over the configured ceiling. There is no JSON-RPC code for "too large". */
const PAYLOAD_TOO_LARGE = -32600;

/** Methods that carry no request body, so there is nothing to read or cap. */
const BODY_LESS_METHODS = ['GET', 'HEAD'];

const tooLarge = (maxBytes: number): RequestBodyResult => ({
	refusal: {
		status: 413,
		code: PAYLOAD_TOO_LARGE,
		message: `Request body exceeds the ${maxBytes} byte limit (MCP_MAX_BODY_BYTES).`,
	},
});

/**
 * Reads a request body into memory under a byte ceiling and parses it as JSON.
 *
 * This exists because the v2 SDK does not cap request bodies: `createMcpHandler` has no body-size
 * option, and the Node adapter's `toWebRequest` reads the stream to completion. Serving on
 * `node:http` rather than Express means `express.json({ limit })` is no longer doing this for us, so
 * an unauthenticated caller could otherwise make the process buffer without bound.
 *
 * The `content-length` check is an early out only. It is advisory and absent under chunked transfer
 * encoding, so the running byte count is the check that actually enforces the ceiling.
 *
 * @param req - The incoming request. Its stream is drained unless the method carries no body.
 * @param maxBytes - Ceiling on the body, in bytes.
 * @returns The parsed body to forward, or the refusal to answer with.
 */
export const readCappedJsonBody = async (req: IncomingMessage, maxBytes: number): Promise<RequestBodyResult> => {
	if (BODY_LESS_METHODS.includes((req.method ?? 'GET').toUpperCase())) {
		return {};
	}

	const declaredLength = Number(req.headers['content-length']);
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		return tooLarge(maxBytes);
	}

	const chunks: Buffer[] = [];
	let received = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
		received += buffer.byteLength;
		if (received > maxBytes) {
			// Stop reading rather than finish draining: the point is to not hold the payload.
			req.destroy();
			return tooLarge(maxBytes);
		}
		chunks.push(buffer);
	}

	if (received === 0) {
		return {};
	}

	try {
		return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
	} catch {
		// Answered here rather than forwarded, because the handler would classify an unparseable
		// body as 2025-era traffic and reject it with an unsupported-protocol-version error, which
		// tells the caller nothing about what was actually wrong.
		return {
			refusal: { status: 400, code: PARSE_ERROR, message: 'Request body is not valid JSON.' },
		};
	}
};
