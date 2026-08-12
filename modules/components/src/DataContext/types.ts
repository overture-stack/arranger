import type { SqonNode } from '@overture-stack/sqon';
import type { AxiosResponse, Method } from 'axios';
import type { Dispatch, SetStateAction } from 'react';

// TODO: This legacyProps import will fail when <Arranger /> is deprecated
// Should be safe to remove afterwards, if the migration path worked out
import type { legacyProps } from '#Arranger/Arranger.js';
import type { UnorderedListStyles } from '#Table/types.js';
import type { CustomThemeType, ThemeOptions } from '#ThemeContext/types/index.js';

export type DisplayType = 'all' | 'bits' | 'boolean' | 'bytes' | 'date' | 'list' | 'nested' | 'number';

export type ColumnCustomiserFn = <Output>(input: ExtendedMappingInterface) => Output;

export interface ColumnMappingInterface {
	accessor: string;
	canChangeShow: boolean;
	displayFormat?: string | null;
	displayName?: string;
	displayType: DisplayType;
	displayValues?: Record<string, string>;
	fieldName: string;
	id: string;
	isArray?: boolean;
	jsonPath?: string | null;
	listStyle?: UnorderedListStyles;
	query?: string | null;
	show: boolean;
	sortable: boolean;
	type?: DisplayType; // being deprecated
}

export interface ColumnSortingInterface {
	desc: boolean;
	fieldName: string;
}

export interface ExtendedMappingInterface {
	displayName: string;
	displayType: string;
	displayValues: Record<string, string>;
	fieldName: string;
	isActive: boolean; // TODO: what does this do?
	isArray: boolean;
	quickSearchEnabled: boolean;
	rangeStep: number | null | undefined;
	type: DisplayType;
	unit: string | null;
}

export interface FacetsConfigsInterface {
	displayName: string;
	displayType: string;
	fieldName: string;
	isActive: boolean;
	show: boolean;
}

export interface TableConfigsInterface {
	columns: ColumnMappingInterface[];
	defaultSorting: ColumnSortingInterface[];
	maxResultsWindow: number;
	rowIdFieldName: string;
}

export interface ConfigsInterface {
	extendedMapping: ExtendedMappingInterface[];
	facetsConfigs: FacetsConfigsInterface;
	tableConfigs: TableConfigsInterface & {
		columns: (string | ColumnMappingInterface)[];
	};
}

/** Contract for `DataProvider`'s `customFetcher` prop. A custom implementation MUST honour
 * `url` when present rather than hardcoding a fixed base: `DataProvider` resolves `apiUrl` plus
 * `catalogue` (when set) into this field before every request, and a fetcher that ignores it
 * will silently keep hitting the unscoped base URL instead of the catalogue-scoped one. `body`
 * is optional: omit it (rather than passing `null`) for a body-less request such as a `GET`,
 * e.g. `useArrangerConfig`'s introspection call. `signal`, when present, should be forwarded to
 * the underlying request for real cancellation; a fetcher that ignores it just loses that
 * benefit; callers that need it (like `useArrangerConfig`) already guard against a stale result
 * being applied regardless, so an implementation without `signal` support stays correct, just
 * less efficient.
 *
 * This contract does NOT cover every use of `apiUrl`: `Table/DownloadButton` reads `apiUrl`
 * straight off context (`useDataContext()`) to build a default download link, submitted via a
 * hidden-iframe HTML form (`utils/download.js`), a real browser navigation with no JS-mediated
 * request a custom fetcher could intercept. A deployment that must route every Arranger request
 * through a proxy (e.g. to attach auth server-side) needs to handle this separately, either by
 * keeping `apiUrl` itself pointed at that proxy, or by overriding `DownloadButton`'s `downloadUrl`
 * theme prop directly. Confirmed nowhere else depends on `apiUrl`: not `apps/search-server`,
 * `modules/graphql-router`, or `modules/charts` (it's a client-side-only, `modules/components`
 * concept), and not the search-server's own CORS/auth handling. */
export type APIFetcherFn = (options: {
	body?: Record<string, unknown> | string | null;
	endpoint?: string;
	endpointTag?: string;
	headers?: Record<string, string>;
	method?: Method;
	signal?: AbortSignal;
	/** Full request base URL, pre-resolved by `DataProvider` (includes `catalogue` when set). Must be used as-is by any custom fetcher; do not substitute a hardcoded base.
	 *
	 * Exception: `useArrangerConfig`'s own bootstrap call (resolving `documentType` when `catalogue` is given but not yet confirmed valid) passes `url` unscoped, since there's no confirmed catalogue yet to scope it to; `endpoint` carries the raw `catalogue` prefix instead for that one call. A fetcher that reconstructs its request URI from `catalogue` plus `endpoint` (e.g. to route through a proxy, rather than using `url` as-is) needs to account for this, or it will double-prefix the catalogue segment for that call specifically. Confirmed as a real incident, not a hypothetical: a proxy-routing consumer hit exactly this double-prefixing bug in `useArrangerConfig`'s bootstrap request. */
	url?: string;
}) => Promise<AxiosResponse<unknown>>;

/** Result of resolving a catalogue's config via `GET /{catalogue}/introspection`. See
 * `useArrangerConfig`. */
export interface ArrangerConfigResult {
	/** The catalogue's real id, when resolved (the response calls this `catalogId` on success, `catalogueId` on a failed catalogue; both are normalized to this one field here). */
	catalogueId?: string;
	description?: string;
	/** The GraphQL root query field name for this catalogue, once resolved. */
	documentType?: string;
	error?: { code: string; message: string };
	isLoading: boolean;
	/** Present only when `error.code` is `ambiguous_document_type`: every catalogue id the given documentType matched. */
	matchingCatalogueIds?: string[];
	status?: 'available' | 'failed';
}

export type SQONType = SqonNode | null;

export type FetchDataFn = (options?: {
	config?: Record<string, any>;
	endpoint?: string;
	endpointTag?: string;
	first?: number;
	offset?: number;
	sort?: any;
	sqon?: SQONType;
	queryName?: string;
}) => Promise<{ total?: number; data?: any } | undefined>;

export interface DataProviderProps<Theme = ThemeOptions> {
	apiUrl: string;
	/** Catalogue to scope this provider to, when the Arranger server it points at is running in
	 * multicatalogue mode. Omit for a single-catalogue deployment (unchanged, existing behaviour):
	 * requests go to `{apiUrl}/graphql`. When given, requests go to `{apiUrl}/{catalogue}/graphql`
	 * instead, matching Arranger's own multicatalogue routing. */
	catalogue?: string;
	children?: React.ReactNode;
	configs?: ConfigsInterface;
	customFetcher?: APIFetcherFn;
	/** The GraphQL root query field name for this provider's catalogue. Required unless
	 * `catalogue` is given: when omitted, `DataProvider` resolves it automatically via
	 * `useArrangerConfig`, at the cost of one extra request before real queries can start. */
	documentType?: string;
	legacyProps?: typeof legacyProps; // TODO: deprecate along with <Arranger/>
	theme?: CustomThemeType<Theme>;
}

export interface DataContextInterface {
	apiFetcher: APIFetcherFn;
	apiUrl: string;
	/** The `catalogue` this provider was scoped to, if any; `undefined` in single-catalogue mode. */
	catalogue?: string;
	/** Set only when `documentType` was resolved automatically (no explicit `documentType` prop) and that resolution failed: not found, or an ambiguous `documentType` match. `undefined` whenever `documentType` was given explicitly, or resolution succeeded. */
	catalogueError?: ArrangerConfigResult['error'];
	documentType: string;
	extendedMapping: ExtendedMappingInterface[];
	fetchData: FetchDataFn;
	isLoadingConfigs: boolean;
	missingProvider?: string;
	/** Node IDs to restrict a network/federated search to; empty means all configured nodes. */
	networkNodesFilter: string[];
	setNetworkNodesFilter: Dispatch<SetStateAction<string[]>>;
	sqon: SQONType;
	setSQON: Dispatch<SetStateAction<SQONType>>;
	tableConfigs: TableConfigsInterface;
}

export interface UseDataContextProps {
	apiUrl?: string;
	callerName?: string;
	customFetcher?: FetchDataFn;
}
