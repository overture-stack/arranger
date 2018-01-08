/* @flow */
/* eslint flowtype/no-weak-types: 0 */

//$FlowIgnore
import type { TGroupSQON } from '../SQONView/types';

export type TRawQuery = {
  sqon?: string,
};

export type TUriQuery = {
  sqon?: ?TGroupSQON,
};

export type TParseIntParam = (s: ?string, d: number) => number;

export type TParseJSONParam = (s: ?string, d: any) => any;

export type TParseSQONParam = (s: ?string, d: ?TGroupSQON) => ?TGroupSQON;
