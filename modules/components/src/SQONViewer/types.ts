import { ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { GenericFn } from '@/utils/noops';

export interface SQONViewerThemeProps {
	EmptyMessage: {
		arrowColor?: string;
	} & ThemeCommon.NonButtonThemeProps;
	SQONBubble: ThemedButtonProps;
	SQONClear: {
		label?: string;
	} & ThemedButtonProps;
	SQONFieldName: ThemedButtonProps;
	SQONGroup: ThemeCommon.NonButtonThemeProps;
	SQONLessOrMore: ThemedButtonProps;
	SQONOp: ThemeCommon.NonButtonThemeProps;
	SQONValue: {
		characterLimit?: number | string;
	} & ThemedButtonProps;
	SQONValueGroup: ThemeCommon.NonButtonThemeProps;
	SQONWrapper: ThemeCommon.NonButtonThemeProps;
}

export interface UseDataBubblesProps {
	dateFormat?: string;
	onClear?: GenericFn;
	setSQON?: (nextSQON: GroupSQONInterface | null) => void;
	translateSQONValue?: GenericFn;
	valueCharacterLimit?: number | string;
}
export interface SQONViewerProps extends UseDataBubblesProps {
	emptyMessage?: string;
	sqon?: GroupSQONInterface | null;
	theme?: SQONViewerThemeProps;
}

// TODO: centralise all these
// SQON types

export type ArrayFieldKeys = 'in' | 'is' | 'filter';

export type ScalarFieldKeys = '>=' | '<=' | '>' | '<';

export type CombinationKeys = 'and' | 'or' | 'not';

export type ArrayFieldValue = Array<string | number> | string;
export type ScalarFieldValue = number;

export interface FilterField {
	fieldNames: string[];
	value: ArrayFieldValue;
}

export interface FilterFieldOperator {
	op: ArrayFieldKeys;
	content: FilterField;
}

export interface ArrayField {
	fieldName: string;
	value: ArrayFieldValue;
}

export interface ScalarField {
	fieldName: string;
	value: ScalarFieldValue;
}

export interface ArrayFieldOperator {
	op: ArrayFieldKeys;
	content: ArrayField;
}

export interface ScalarFieldOperator {
	op: ScalarFieldKeys;
	content: ScalarField;
}

export type FieldOperator = ArrayFieldOperator | ScalarFieldOperator;

// export type RepoFiltersType = {
//   op: 'and';
//   content: FieldOperator[];
// };

export type ValueOpTypes = ArrayFieldKeys & CombinationKeys & ScalarFieldKeys;

export interface ValueContentInterface {
	entity?: string;
	fieldName: string;
	fieldNames?: string[];
	value: any | any[];
}

export interface ValueSQONInterface {
	content: ValueContentInterface;
	op: ValueOpTypes;
}

export type GroupValueSQONType = FieldOperator[];

export type GroupOpTypes = 'and' | 'or';

export interface GroupSQONInterface {
	content: GroupValueSQONType;
	op: GroupOpTypes;
}

// export type TCombineValues = (x: TValueSQON, y: TValueSQON) => TValueSQON | void;

// export type TMergeSQON = (q?: TGroupSQON, c?: TGroupSQON) => TGroupSQON | void;

// export type TMergeEnum = boolean | 'toggle' | 'replace';

// export type TMergeFns = (v: TMergeEnum) => TMergeSQON;

// export type TMergeQuery = (q?: TUriQuery, c: TRawQuery, t: TMergeEnum) => TUriQuery;

// export type TSortSQON = (a: TValueSQON, b: TValueSQON) => number;

// export type TFilterByAllowlist = (o?: TRawQuery, w?: Array<string>) => TRawQuery;

// export type TRemoveSQON = (fieldName: string, query: TGroupSQON) => TGroupSQON | void;
