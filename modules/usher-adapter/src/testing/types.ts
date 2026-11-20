import type { IndexProbe } from '@overture-stack/arranger-graphql-router';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-bridge--express';
import type { Enforcement } from '@overture-stack/usher-types';

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

/** Why the Bridge denies a catalogue. */
export type DenyReason = Extract<Enforcement, { kind: 'deny' }>['reason'];

/** One line a `BridgeLogger` was given: its level, its fields and its fixed message. */
export type LoggedLine = Readonly<{ fields: Record<string, unknown>; level: keyof BridgeLogger; message: string }>;

/** One question put to a stub probe: which check, and what it was asked about. */
export type ProbeCall = Readonly<{ argument: unknown; check: keyof IndexProbe }>;

/** A stand-in for the Bridge's `register`, with every registration it was handed. */
export type RegisterRecorder = Readonly<{
	bridge: Pick<BridgeCore, 'register'>;

	/** Every registration handed to `register`, in order. */
	registered: readonly Readonly<Record<string, KeyRegistration>>[];
}>;

/** One fixture row: the case it traces to, the result, and the records it reveals. */
export type ResultRow = Readonly<{
	case: string;
	description: string;
	result: Enforcement;
	visible: readonly string[];
}>;

/** A stub probe, with every question put to it in the order asked. */
export type StubProbe = Readonly<{ calls: readonly ProbeCall[]; probe: IndexProbe }>;
