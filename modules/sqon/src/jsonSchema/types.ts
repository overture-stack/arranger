export type JsonSchemaObject = Record<string, unknown>;

export type SqonJsonSchema = JsonSchemaObject & {
	$schema: string;
	$id: string;
	$ref: string;
	$defs: Record<string, unknown>;
	description: string;
	title: string;
};

export type VersionedSqonJsonSchema = SqonJsonSchema & {
	version: string;
};
