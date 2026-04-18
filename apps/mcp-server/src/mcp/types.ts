export interface McpResourceDefinition {
	name: string;
	description: string;
	uri: string;
}

export interface McpToolArgument {
	name: string;
	description: string;
	required?: boolean;
	type: 'string' | 'number' | 'boolean';
}

export interface McpToolDefinition {
	name: string;
	description: string;
	inputSchema?: {
		type: 'object';
		properties: Record<string, { type: string; description?: string }>;
		required?: string[];
	};
}
