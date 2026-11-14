// The module's vocabularies as `as const` objects. Each union type is derived from its object in the file that owns
// the type, so code checks against a named constant while consumers can still use the plain string. Other parties'
// strings are left alone: `mcp-client`'s call outcomes, MCP's elicitation actions, the OpenAI wire format.

/** Every event's `type`. */
export const EVENT_TYPES = {
	RUN_STARTED: 'run_started',
	TOOLS_CHANGED: 'tools_changed',
	MODEL_REQUEST: 'model_request',
	CONTENT_CARRIED: 'content_carried',
	TOKEN: 'token',
	MODEL_RESPONSE: 'model_response',
	MALFORMED_TOOL_CALL: 'malformed_tool_call',
	EMPTY_REPLY: 'empty_reply',
	CONTEXT_SHORTENED: 'context_shortened',
	OUTPUT_LIMIT: 'output_limit',
	MODEL_ERROR: 'model_error',
	APPROVAL_REQUIRED: 'approval_required',
	APPROVAL_ANSWERED: 'approval_answered',
	TOOL_CALL: 'tool_call',
	INPUT_REQUIRED: 'input_required',
	INPUT_ANSWERED: 'input_answered',
	QUESTION_WITHDRAWN: 'question_withdrawn',
	INPUT_STATE_REJECTED: 'input_state_rejected',
	TOOL_RESULT: 'tool_result',
	DONE: 'done',
} as const;

/** Why a run ended. */
export const DONE_REASONS = {
	/** The model answered in text. */
	ANSWERED: 'answered',
	/** The run reached its turn limit. */
	TURN_LIMIT: 'turn_limit',
	/** The run reached its tool-call limit. */
	TOOL_CALL_LIMIT: 'tool_call_limit',
	/** The run reached its wall-clock limit. */
	TIME_LIMIT: 'time_limit',
	/** The consumer's signal aborted the run. */
	CANCELLED: 'cancelled',
	/** The model server failed; the conversation is still valid. */
	MODEL_ERROR: 'model_error',
	/** The request could not fit, or the server truncated it anyway. */
	CONTEXT_WINDOW: 'context_window',
	/** The reply was cut off at the output limit, and was not retried or was cut off again. */
	OUTPUT_LIMIT: 'output_limit',
	/** The model returned nothing, a parse failure, and was not retried or was empty again. */
	EMPTY_REPLY: 'empty_reply',
	/** The prompt the run started from could not be fetched, or its server is not trusted. */
	PROMPT_FAILED: 'prompt_failed',
	/** A server's surface could not be re-read at the start of the run. */
	SURFACE_ERROR: 'surface_error',
	/** Two tools reduced to one name at the start of the run. */
	TOOL_COLLISION: 'tool_collision',
} as const;

/** What the approval policy decides for a call. `ASK` puts the call in front of the consumer. */
export const APPROVAL_DECISIONS = {
	ALLOW: 'allow',
	DENY: 'deny',
	ASK: 'ask',
} as const;

/** How a call ended when host-core, not `mcp-client`, decided it. */
export const HOST_OUTCOMES = {
	DENIED: 'denied',
	MALFORMED: 'malformed',
	UNKNOWN_TOOL: 'unknown_tool',
	NOT_RUN: 'not_run',
	ABANDONED: 'abandoned',
	CROSSING_REFUSED: 'crossing_refused',
} as const;

/** Who or what denied a call. */
export const DENIED_BY = {
	POLICY: 'policy',
	PERSON: 'person',
	TIMEOUT: 'timeout',
	/** The policy threw, or returned something other than a decision. */
	POLICY_ERROR: 'policy_error',
} as const;

/** Why a request was sent again. */
export const RETRY_KINDS = {
	EMPTY_REPLY: 'empty_reply',
	OUTPUT_LIMIT: 'output_limit',
} as const;

/** What a run does with a model reply. */
export const REPLY_DECISIONS = {
	TOOL_CALLS: 'tool_calls',
	ANSWERED: 'answered',
	OUTPUT_LIMIT: 'output_limit',
	EMPTY_REPLY: 'empty_reply',
} as const;

/** What a question waiting on the consumer asks for. */
export const QUESTION_KINDS = {
	/** A pre-call approval the policy asked for. */
	APPROVAL: 'approval',
	/** A server's question, from inside a call. */
	CONFIRMATION: 'confirmation',
} as const;

/** What `respond` did with an answer. */
export const RESPOND_RESULTS = {
	ACCEPTED: 'accepted',
	/** No question was ever issued with that id. */
	UNKNOWN: 'unknown',
	/** The question was answered already, or withdrawn because its call or run was cancelled. */
	ALREADY_ANSWERED: 'already_answered',
	TIMED_OUT: 'timed_out',
} as const;

/** How a question was settled. */
export const SETTLED_BY = {
	ANSWER: 'answer',
	TIMEOUT: 'timeout',
} as const;

/** How a question closed, for an answer that arrives after it. */
export const QUESTION_CLOSURES = {
	ANSWERED: 'answered',
	TIMED_OUT: 'timed_out',
	WITHDRAWN: 'withdrawn',
} as const;

/** What a server has returned into the conversation, in the order it can only rise. */
export const RETURNED_DATA = {
	NONE: 'none',
	/** From a server the person attests holds only open-access data, so it may cross to other servers. */
	UNRESTRICTED: 'unrestricted',
	/** From any other server, so it may not. */
	RESTRICTED: 'restricted',
} as const;

/** Where an unanswered call stood when the state was taken. */
export const CALL_STANDINGS = {
	/** Waiting on a server's question. */
	CONFIRMING: 'confirming',
	/** On the wire, with its effect unknown. */
	IN_FLIGHT: 'in_flight',
	/** Not started. */
	QUEUED: 'queued',
} as const;

/** What to do when a request would not fit the context window. */
export const CONTEXT_POLICIES = {
	/** Stub older tool results in the request. */
	SHORTEN: 'shorten',
	/** End the run instead. */
	FAIL: 'fail',
} as const;

/** Why the model stopped. */
export const STOP_REASONS = {
	STOP: 'stop',
	/** The reply reached the output limit. */
	LENGTH: 'length',
	TOOL_CALLS: 'tool_calls',
	CONTENT_FILTER: 'content_filter',
	OTHER: 'other',
} as const;

/** Why the model server gave no usable reply. */
export const MODEL_ERROR_KINDS = {
	/** An HTTP error status, with its body. */
	HTTP: 'http',
	/** The provider's own timeout ran out. */
	TIMEOUT: 'timeout',
	/** The server refused the request. */
	REFUSAL: 'refusal',
	/** The stream ended without a finish reason, or without a response. */
	STREAM_ENDED: 'stream_ended',
	/** The request could not be sent or read. */
	NETWORK: 'network',
	/** The run's signal aborted the request. */
	ABORTED: 'aborted',
	/**
	 * The server counted fewer prompt tokens than the previous turn for a longer request, so it dropped messages on
	 * its own (host-core's backstop, not the provider's).
	 */
	TRUNCATED: 'truncated',
	/** Anything else, including a provider that threw. */
	UNKNOWN: 'unknown',
} as const;

/** Whether a provider could parse a tool call. */
export const TOOL_CALL_KINDS = {
	CALL: 'call',
	MALFORMED: 'malformed',
} as const;

/** What a provider's stream yields. */
export const STREAM_ITEM_TYPES = {
	DELTA: 'delta',
	RESPONSE: 'response',
	ERROR: 'error',
} as const;

/** Every conversation item's `type`. */
export const ITEM_TYPES = {
	MESSAGE: 'message',
	FUNCTION_CALL: 'function_call',
	FUNCTION_CALL_OUTPUT: 'function_call_output',
} as const;

/** Who a conversation message is from. */
export const ROLES = {
	USER: 'user',
	ASSISTANT: 'assistant',
} as const;

/** Why a tool is not offered to the model. */
export const LEFT_OUT_REASONS = {
	/** Its reduced name collides with another tool's. */
	COLLISION: 'collision',
} as const;

/** What a step of a run returns when the run's signal aborted it. */
export const STOPPED = 'stopped';

/** The prefixes of the ids host-core gives calls and prompt requests. */
export const ID_PREFIXES = {
	CALL: 'call',
	PROMPT: 'prompt',
} as const;
