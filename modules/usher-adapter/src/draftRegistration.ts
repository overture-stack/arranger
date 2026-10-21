import type { SqonNode } from '@overture-stack/sqon';

/**
 * A local draft of the `RecordKeyRegistration` Usher's package is about to export, in which a category is a
 * named SQON condition its records meet rather than a value held in one category field. It stands in until
 * that type is released, and is replaced by it then.
 */
export type DraftRecordKeyRegistration = {
	/** Concrete categories no record of this catalogue can carry, so none holds a condition. */
	absentCategories?: readonly string[];
	categories: {
		/** The condition a record meets to carry each global category, by its scoped name. */
		global: Readonly<Record<`global.${string}`, SqonNode>>;
		/** Each resource's own categories, by the resource's identifier, each condition by its scoped name. */
		resource?: Readonly<Record<string, Readonly<Record<`resource.${string}`, SqonNode>>>>;
	};
	kind: 'record';
	/** The field holding a record's resource identifier. */
	resourceFieldName: string;
	/** The resources this catalogue holds. */
	resources?: readonly string[];
};
