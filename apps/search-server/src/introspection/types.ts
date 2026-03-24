export type IntrospectionResponse = {
	catalogCount: number;
	catalogs: Record<
		string,
		{
			documentType: string;
			paths: {
				fields?: string;
				graphql: string;
				introspection: string;
			};
		}
	>;
	mode: 'single' | 'multi';
	sqonSchemaPath: string;
};

export type CatalogFieldIntrospection = {
	displayName: string;
	type: string;
	unit?: string | null;
	validOperators: string[];
};

export type CatalogIntrospectionResponse = {
	catalogId: string;
	documentType: string;
	generatedAt: string;
	meta: {
		authFiltered: boolean;
	};
	fields: Record<string, CatalogFieldIntrospection>;
};
