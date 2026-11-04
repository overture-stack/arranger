import type { IndexProbe } from '@overture-stack/arranger-graphql-router';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-express-bridge';
import type { Enforcement } from '@overture-stack/usher-types';

type Results = Readonly<Record<string, Enforcement>>;

/** One record of the synthetic catalogue, named by `name` so a suite can say which it expects. */
export type CatalogueRecord = Readonly<{
	data_category?: string;
	files: readonly Readonly<{ file_type: string }>[];
	name: string;
	sample_type?: string;
	study_id: string;
}>;

/** A kind of denial, as the GraphQL router names it. */
export type DenialKind = 'access-too-broad' | 'misconfigured' | 'no-access';

/** Why the bridge denies a catalogue. */
export type DenyReason = Extract<Enforcement, { kind: 'deny' }>['reason'];

/** The fake bridge, with what it recorded. */
export type FakeBridge = Readonly<{
	core: BridgeCore;

	/** Every registration handed to `register`, in order. */
	registered: readonly Readonly<Record<string, KeyRegistration>>[];

	/** Switches the behaviour the next requests meet. */
	setMode(mode: FakeBridgeMode): void;

	/** Every credential `resolve` was asked for that the table does not hold. */
	unexpected: readonly (string | null)[];
}>;

/**
 * The bridge's own behaviours the fake reproduces. `uncertain` attaches the open tier, the anonymous
 * principal marked open-tier only and every signed-in one suspended with a null subject;
 * `exchangeFailed` does the same for one credential alone, the bridge being normal.
 */
export type FakeBridgeMode =
	| Readonly<{ kind: 'cold' }>
	| Readonly<{ credential: string; kind: 'exchangeFailed' }>
	| Readonly<{ kind: 'normal' }>
	| Readonly<{ kind: 'refused' }>
	| Readonly<{ kind: 'uncertain' }>;

/** What the fake answers: the open tier's results, and each signed-in principal's by credential. */
export type FakeBridgeTable = Readonly<{
	anonymous: Results;
	principals: Readonly<Record<string, Readonly<{ results: Results; subject: string }>>>;
}>;

/** One line a `BridgeLogger` was given: its level, its fields and its fixed message. */
export type LoggedLine = Readonly<{ fields: Record<string, unknown>; level: keyof BridgeLogger; message: string }>;

/** One question put to a stub probe: which check, and what it was asked about. */
export type ProbeCall = Readonly<{ argument: unknown; check: keyof IndexProbe }>;

/** One fixture row: the case it traces to, the result, and the records it reveals. */
export type ResultRow = Readonly<{
	case: string;
	description: string;
	result: Enforcement;
	visible: readonly string[];
}>;

/** A stub probe, with every question put to it in the order asked. */
export type StubProbe = Readonly<{ calls: readonly ProbeCall[]; probe: IndexProbe }>;
