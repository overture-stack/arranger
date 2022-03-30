import { ThemedButtonProps } from '@/Button/types';
import { ThemeCommon } from '@/ThemeContext/types';
import { GenericFn } from '@/utils/noopFns';

export interface SQONViewerThemeProps {
  EmptyMessage: ThemeCommon.NonButtomThemeProps;
  SQONBubble: ThemedButtonProps;
  SQONClear: ThemedButtonProps;
  SQONField: ThemedButtonProps;
  SQONGroup: ThemeCommon.NonButtomThemeProps;
  SQONLessOrMore: ThemedButtonProps;
  SQONOp: ThemeCommon.NonButtomThemeProps;
  SQONValue: {
    characterLimit?: number | string;
  } & ThemedButtonProps;
  SQONValueGroup: ThemeCommon.NonButtomThemeProps;
  SQONWrapper: ThemeCommon.NonButtomThemeProps;
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
  sqon: GroupSQONInterface | null;
}

// TODO: centralise all these
// SQON types

export type ArrayFieldKeys = 'in' | 'is' | 'filter';

export type ScalarFieldKeys = '>=' | '<=' | '>' | '<';

export type CombinationKeys = 'and' | 'or' | 'not';

export type ArrayFieldValue = Array<string | number> | string;
export type ScalarFieldValue = number;

export interface FilterField {
  fields: string[];
  value: ArrayFieldValue;
}

export interface FilterFieldOperator {
  op: ArrayFieldKeys;
  content: FilterField;
}

export interface ArrayField {
  field: string;
  value: ArrayFieldValue;
}

export interface ScalarField {
  field: string;
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
  field: string;
  fields?: string[];
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

// export type TFilterByWhitelist = (o?: TRawQuery, w?: Array<string>) => TRawQuery;

// export type TRemoveSQON = (field: string, query: TGroupSQON) => TGroupSQON | void;
