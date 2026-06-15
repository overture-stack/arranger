export type IntrospectionResponse = {
	catalogCount: number;
	catalogs: Record<
		string,
		{
			description?: string;
			documentType: string;
			paths: {
				fields?: string;
				graphql: string;
				introspection: string;
			};
		}
	>;
	mode: 'single' | 'multiple';
	sqonSchemaPath: string;
};

export type SqonOperatorDetail = {
	applicableTo: 'all' | string[];
	op: string;
	valueType: string;
};

export type SqonIntrospectionResponse = {
	$schema: string;
	aliases: Record<string, string>;
	description: string;
	operators: {
		combination: string[];
		field: SqonOperatorDetail[];
	};
	schema: Record<string, unknown>;
	title: string;
	version: string;
};

export type CatalogFieldIntrospection = {
	displayName: string;
	type: string;
	unit?: string | null;
};

export type CatalogIntrospectionResponse = {
	catalogId: string;
	description?: string;
	documentType: string;
	generatedAt: string;
	meta: {
		authFiltered: boolean;
	};
	operators: Record<string, string[]>;
	fields: Record<string, CatalogFieldIntrospection>;
};
