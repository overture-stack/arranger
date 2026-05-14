// TODO: reorganize these constants into their actual dependency tree: server/node (including networking) vs catalog (and array nested properties), etc.
import type { SqonNode } from '@overture-stack/sqon';

import type { ValuesOf } from '#tools/typeFns.js';

import type {
	configArrangerNetworkProperties,
	baseNodeProperties,
	chartsProperties,
	configArrangerFeatureFlagProperties,
	configFeatureFlagProperties,
	configOptionalProperties,
	configRequiredProperties,
	configRuntimeFeatureFlagProperties,
	dataFieldProperties,
	downloadProperties,
	facetsProperties,
	localNodeProperties,
	remoteNodeProperties,
	setsProperties,
	tableProperties,
} from './constants.js';

export * from './constants.js';
export * from './networkAggregationConfigUtils.js';

export type ArrangerFeatureFlagConfigs = Record<ValuesOf<typeof configArrangerFeatureFlagProperties>, boolean>;
export type RuntimeFeatureFlagConfigs = Record<ValuesOf<typeof configRuntimeFeatureFlagProperties>, boolean>;
export type AllFeatureFlagConfigs = Record<ValuesOf<typeof configFeatureFlagProperties>, boolean>;

// Catalog Configs

export type AggConfigs = {
	[dataFieldProperties.DISPLAY_NAME]: string;
	[dataFieldProperties.DISPLAY_TYPE]: string;
	[dataFieldProperties.FIELD_NAME]: string;
	[dataFieldProperties.IS_ACTIVE]: boolean; // TODO: what is this? active = API vs show = UI? "isActive"
	[dataFieldProperties.SHOW]: boolean;
	// TODO: implement these
	// can change show
	// max results
	// collapsible
};

export type ChartConfigs = {
	[chartsProperties.QUERY]: string;
};

export type ColumnConfigs = {
	[dataFieldProperties.ACCESSOR]: string;
	[dataFieldProperties.CAN_CHANGE_SHOW]: boolean;
	[dataFieldProperties.DISPLAY_FORMAT]: string;
	[dataFieldProperties.DISPLAY_NAME]: string;
	[dataFieldProperties.DISPLAY_TYPE]: string;
	[dataFieldProperties.DISPLAY_VALUES]: Record<string, any>; // TODO: not "any". used for "readable" replacements e.g. true as "yes"
	[dataFieldProperties.FIELD_NAME]: string;
	[dataFieldProperties.IS_ARRAY]: boolean; // should it be displayed as a list of items, or leave as a single string
	[dataFieldProperties.JSON_PATH]: string;
	[dataFieldProperties.QUERY]: string;
	[dataFieldProperties.SHOW]: boolean;
	[dataFieldProperties.SORTABLE]: boolean;
};

export type DownloadsConfigs = {
	[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]?: boolean;
	[downloadProperties.MAX_ROWS]?: number;
	[downloadProperties.STREAM_BUFFER_SIZE]?: number;
};

// TODO: make this a union of types
export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'nested' | 'number';

export type ExtendedConfigs = {
	[dataFieldProperties.DISPLAY_NAME]: string;
	[dataFieldProperties.DISPLAY_TYPE]: string;
	[dataFieldProperties.DISPLAY_VALUES]: Record<string, any>; // TODO: not "any"
	[dataFieldProperties.FIELD_NAME]: string;
	[dataFieldProperties.IS_ACTIVE]: boolean; // TODO: what is this?
	[dataFieldProperties.IS_ARRAY]: boolean;
	[dataFieldProperties.PRIMARY_KEY]: boolean;
	[dataFieldProperties.QUICKSEARCH_ENABLED]: boolean;
	[dataFieldProperties.RANGE_STEP]: number;
	[dataFieldProperties.TYPE]: DisplayType;
	[dataFieldProperties.UNIT]: string;
};

export type FacetsConfigs = {
	[facetsProperties.AGGS]: AggConfigs[];
};

export type MatchBoxConfigs = {
	[dataFieldProperties.DISPLAY_NAME]: string;
	[dataFieldProperties.FIELD_NAME]: string;
};

export type SetsConfigs = {
	[setsProperties.INDEX]: string;
	[setsProperties.TYPE]: string;
};

export type SortingConfigs = {
	[tableProperties.DESCENDING]: boolean;
	[dataFieldProperties.FIELD_NAME]: string;
	[dataFieldProperties.IS_ACTIVE]: boolean;
};

export type TableConfigs = {
	[tableProperties.COLUMNS]: ColumnConfigs[];
	[tableProperties.DEFAULT_SORTING]?: SortingConfigs[];
	[tableProperties.MAX_RESULTS_WINDOW]?: number;
	[tableProperties.ROW_ID_FIELD_NAME]?: string;
};

export type BaseNodeConfig = {
	[baseNodeProperties.DISPLAY_NAME]: string;
};
export type RemoteNodeConfig = {
	[remoteNodeProperties.DOCUMENT_TYPE]: string;
	[remoteNodeProperties.GRAPHQL_URL]: string;
} & BaseNodeConfig;
export type LocalNodeConfig = {
	[localNodeProperties.CATALOG_ID]: string;
} & BaseNodeConfig;

export type NodeConfig = RemoteNodeConfig | LocalNodeConfig;

export type NetworkConfig = {
	[configArrangerNetworkProperties.REMOTE_NODES]: RemoteNodeConfig[];

	// TODO: To support multi-catalog, we need to update this to be `'localNodes': LocalNodeConfig[];`
	[configArrangerNetworkProperties.LOCAL_NODE]?: BaseNodeConfig;
};

export type GetServerSideFilterFn<Context extends object> = (context: Context) => SqonNode;

export type SearchEngineType = 'elasticsearch' | 'opensearch';

export type ConfigsObject<Context extends object> = {
	// Arranger will fail without these
	[configRequiredProperties.DOCUMENT_TYPE]: string;
	[configRequiredProperties.ES_INDEX]: string;
	[configRequiredProperties.ES_PASS]: string;
	[configRequiredProperties.ES_USER]: string;
} & Partial<
	// these either have defaults or can be autogenerated
	AllFeatureFlagConfigs & {
		getServerSideFilter: GetServerSideFilterFn<Context>;
		[configOptionalProperties.CATALOG_ID]: string;
		[configOptionalProperties.ES_HOST]: string;
		[configOptionalProperties.GRAPHQL_MAX_ALIASES]: number;
		[configOptionalProperties.GRAPHQL_MAX_DEPTH]: number;
		[configOptionalProperties.NETWORK_AGGREGATION]: NetworkConfig;
		[configOptionalProperties.SEARCH_ENGINE]: SearchEngineType;
		// dependent libraries
		[configOptionalProperties.CHARTS]: ChartConfigs;
		[configOptionalProperties.DOWNLOADS]: DownloadsConfigs;
		[configOptionalProperties.EXTENDED]: ExtendedConfigs[];
		[configOptionalProperties.FACETS]: FacetsConfigs;
		[configOptionalProperties.MATCHBOX]: MatchBoxConfigs[];
		[configOptionalProperties.SETS]: SetsConfigs;
		[configOptionalProperties.TABLE]: TableConfigs;
	}
>;
