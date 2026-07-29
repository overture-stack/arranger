import type { CatalogueErrorDetail } from '@overture-stack/arranger-graphql-router';
import type { VersionedSqonJsonSchema } from '@overture-stack/sqon';

import type { CatalogueStatus, ServerAggregateStatus } from '#availability/index.js';

export type IntrospectionResponse = {
	catalogCount: number;
	catalogs: Record<
		string,
		{
			description?: string;
			documentType: string;
			error?: CatalogueErrorDetail;
			paths: {
				fields?: string;
				graphql: string;
				introspection: string;
			};
			status: CatalogueStatus;
		}
	>;
	mode: 'single' | 'multiple';
	sqonSchemaPath: string;
	status: ServerAggregateStatus;
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
	schema: VersionedSqonJsonSchema;
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
