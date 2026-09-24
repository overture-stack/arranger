/**
 * JSON-RPC code for a request this server refused at the HTTP layer, before any MCP message was
 * read. The HTTP status carries what was actually wrong; this code only says that the refusal
 * happened below the protocol.
 *
 * `-32000` to `-32099` is the range JSON-RPC reserves for implementation-defined server errors, and
 * `-32000` is what the SDK answers with for the equivalent refusals it makes on this same endpoint:
 * a disallowed `Host` or `Origin` (403), a verb other than POST (405), and a body that is not
 * `application/json` (415). Matching it keeps one classification across the whole endpoint, which
 * matters because a client cannot tell which layer answered it.
 *
 * Errors about a message that was read keep their standard code instead, so `PARSE_ERROR` and
 * `INTERNAL_ERROR` come straight from the SDK rather than through here. The SDK exports no constant
 * for this one, which is why it is declared here rather than imported.
 */
export const TRANSPORT_REJECTION = -32000;
