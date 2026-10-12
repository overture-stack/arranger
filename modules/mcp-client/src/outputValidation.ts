import { type CallToolResult, type JsonSchemaType, type Tool } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';

import { exceedsDepth } from './json.js';
import { errorMessage } from './outcomes.js';

/** The largest `outputSchema` compiled, serialized; a larger one makes every result `output_invalid`. */
export const MAX_OUTPUT_SCHEMA_BYTES = 64 * 1024;

/** The deepest `outputSchema` compiled, in JSON levels; a deeper one makes every result `output_invalid`. */
export const MAX_OUTPUT_SCHEMA_DEPTH = 32;

/** Checks one tool's `structuredContent`, returning why it failed, or `undefined`. */
type CheckContent = (structuredContent: unknown) => string | undefined;

/** One snapshot's output checks, by tool name. Only tools that declare an `outputSchema` have one. */
export type OutputValidators = ReadonlyMap<string, CheckContent>;

const always =
	(message: string): CheckContent =>
	() =>
		message;

/** Guards the compiler: a server's schema is untrusted, and compiling costs time and memory as it grows. */
const compile = (tool: Tool, schema: JsonSchemaType, validator: AjvJsonSchemaValidator): CheckContent => {
	if (exceedsDepth(schema, MAX_OUTPUT_SCHEMA_DEPTH)) {
		return always(`Tool ${tool.name}'s outputSchema nests deeper than ${MAX_OUTPUT_SCHEMA_DEPTH} levels`);
	}
	if (Buffer.byteLength(JSON.stringify(schema)) > MAX_OUTPUT_SCHEMA_BYTES) {
		return always(`Tool ${tool.name}'s outputSchema is larger than ${MAX_OUTPUT_SCHEMA_BYTES} bytes`);
	}

	let validate: ReturnType<AjvJsonSchemaValidator['getValidator']>;
	try {
		validate = validator.getValidator(schema);
	} catch (error) {
		return always(`Tool ${tool.name} has an invalid outputSchema: ${errorMessage(error)}`);
	}

	return (structuredContent) => {
		try {
			const checked = validate(structuredContent);
			return checked.valid
				? undefined
				: `Structured content does not match the tool's output schema: ${checked.errorMessage}`;
		} catch (error) {
			return `Failed to validate structured content: ${errorMessage(error)}`;
		}
	};
};

/**
 * Compiles a snapshot's output schemas, as the SDK's `callTool()` compiles a cached `tools/list`.
 *
 * @remarks
 * Each snapshot gets its own Ajv instance. Ajv keeps every schema it compiles, and serves a schema with an `$id`
 * from that cache, so a shared instance would grow without end and could confuse two servers' schemas.
 *
 * @param tools - The snapshot's tools.
 * @returns A check for each tool that declares an `outputSchema`.
 */
export const compileOutputValidators = (tools: readonly Tool[]): OutputValidators => {
	const declaring = tools.filter((tool) => tool.outputSchema !== undefined);
	if (declaring.length === 0) {
		return new Map();
	}
	const validator = new AjvJsonSchemaValidator();
	return new Map(
		declaring.map((tool) => [tool.name, compile(tool, tool.outputSchema as JsonSchemaType, validator)] as const),
	);
};

/**
 * Checks a tool's final result against its declared `outputSchema`.
 *
 * @remarks
 * As in the SDK's `callTool()`, an error result is never checked, and a result without `structuredContent`
 * fails. Unlike `callTool()`, a schema that cannot be compiled does not stop the call: the tool runs, and its
 * result is `output_invalid`.
 *
 * @param validators - The checks compiled from the latest snapshot.
 * @param name - The tool's name.
 * @param result - The final result.
 * @returns Why the result failed, or `undefined` if it passed.
 */
export const checkToolOutput = (
	validators: OutputValidators,
	name: string,
	result: CallToolResult,
): string | undefined => {
	const check = validators.get(name);
	if (!check || result.isError) {
		return undefined;
	}
	if (result.structuredContent === undefined) {
		return `Tool ${name} has an output schema but did not return structured content`;
	}
	return check(result.structuredContent);
};
