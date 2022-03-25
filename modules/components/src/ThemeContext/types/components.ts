import { AggregationsThemeProps } from '@/Aggs/types';
import { DataTableThemeProps } from '@/DataTable/types';
import { ArrowIconThemeProps } from '@/Icons/ArrowIcon/types';
import { RecursivePartial } from '@/utils/types';

export type Components = AggregationsThemeProps & ArrowIconThemeProps & DataTableThemeProps;

export type ComponentsOptions = RecursivePartial<Components>;
