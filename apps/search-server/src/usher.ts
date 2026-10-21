import { configRootProperties } from '@overture-stack/arranger-types/configs/constants';
import type { CatalogueIndex, UsherAccessControl } from '@overture-stack/arranger-usher-adapter';
import type { BridgeCore, KeyRegistration } from '@overture-stack/usher-express-bridge';
import type { RequestHandler } from 'express';

import { startupRefusal } from '#configs/fromEnv/enableAccessControl.js';
import { readUsherBridgeEnv } from '#configs/fromEnv/usherBridgeEnv.js';
import { USHER_REGISTRATION_FILE } from '#configs/fromFiles/fileHandlers.js';
import type { CataloguesMap, UsherRegistrations, UsherSeam } from '#configs/types/index.js';

/** What the image holds once access control is on: the adapter, the bridge, and the bridge's Express layer. */
export type ImageUsher = Readonly<{
	accessControl: UsherAccessControl;
	bridge: BridgeCore;
	layer: RequestHandler;
}>;

const quotedList = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

/**
 * Refuses startup for every catalogue the Usher adapter cannot serve: one configuring network search,
 * which access control does not serve until the federation posture is decided, and one with no
 * registration beside its configuration.
 */
const refuseUnservableCatalogues = ({
	catalogs,
	usherRegistrations,
}: {
	catalogs: CataloguesMap;
	usherRegistrations: UsherRegistrations;
}): void => {
	const configuringNetwork = Object.entries(catalogs)
		.filter(([, configs]) => configs[configRootProperties.NETWORK_AGGREGATION] !== undefined)
		.map(([catalogueId]) => catalogueId);

	if (configuringNetwork.length > 0) {
		throw startupRefusal(
			`ENABLE_ACCESS_CONTROL is true, and access control does not serve network search yet, which catalogue ${quotedList(configuringNetwork)} configures. Remove its network configuration to start with access control.`,
		);
	}

	const unregistered = Object.keys(catalogs).filter((catalogueId) => !Object.hasOwn(usherRegistrations, catalogueId));

	if (unregistered.length > 0) {
		throw startupRefusal(
			`ENABLE_ACCESS_CONTROL is true, and catalogue ${quotedList(unregistered)} has no ${USHER_REGISTRATION_FILE} beside its base.json, so the Usher adapter has nothing to enforce for it.`,
		);
	}
};

/** The bridge built from the environment, writing its events and the adapter's to standard output as JSON lines. */
const usherFromEnvironment = async (): Promise<UsherSeam> => {
	const bridgeEnv = readUsherBridgeEnv();
	const [{ createBridgeCore }, { createBridgeLogger }] = await Promise.all([
		import('@overture-stack/usher-express-bridge'),
		import('@overture-stack/arranger-usher-adapter'),
	]);
	const logger = createBridgeLogger({ write: (line) => process.stdout.write(`${line}\n`) });

	return { bridge: createBridgeCore({ ...bridgeEnv, logger }), logger };
};

/**
 * Prepares the Usher adapter for the image, loading the Usher packages only now, so a deployment
 * without access control never loads them. Refuses startup for a catalogue it cannot serve before
 * the bridge is built, registered with or started.
 *
 * @param catalogs every catalogue the image loaded from its configuration.
 * @param seam a host's own bridge and logger, used in place of the environment's.
 * @param usherRegistrations each catalogue's `usher.json`, by catalogue id.
 */
export const prepareUsher = async ({
	catalogs,
	seam,
	usherRegistrations,
}: {
	catalogs: CataloguesMap;
	seam?: UsherSeam;
	usherRegistrations: UsherRegistrations;
}): Promise<ImageUsher> => {
	refuseUnservableCatalogues({ catalogs, usherRegistrations });

	const { bridge, logger } = seam ?? (await usherFromEnvironment());
	const [{ createUsherAccessControl }, { createUsherMiddleware }] = await Promise.all([
		import('@overture-stack/arranger-usher-adapter'),
		import('@overture-stack/usher-express-bridge'),
	]);
	// Each registration is read from its file unvalidated; the bridge validates it when registering it.
	const catalogues = Object.fromEntries(
		Object.keys(catalogs).map((catalogueId) => [catalogueId, usherRegistrations[catalogueId] as KeyRegistration]),
	);

	return {
		accessControl: createUsherAccessControl({ bridge, catalogues, logger }),
		bridge,
		layer: createUsherMiddleware(bridge),
	};
};

/**
 * Each catalogue's configuration with the adapter's callback for it as its server-side filter.
 *
 * @param catalogs every catalogue the image loaded.
 * @param accessControl the adapter.
 */
export const withUsherFilters = (catalogs: CataloguesMap, accessControl: UsherAccessControl): CataloguesMap =>
	Object.fromEntries(
		Object.entries(catalogs).map(([catalogueId, configs]) => [
			catalogueId,
			{ ...configs, getServerSideFilter: accessControl.filterFor(catalogueId) },
		]),
	);

/**
 * Stops the bridge and waits until its work in flight has ended. A stop that fails is logged as
 * `access_control.bridge_stop_failed` rather than thrown, so whatever led to the stop keeps its own outcome.
 *
 * @param bridge the image's bridge.
 */
export const stopUsherBridge = async (bridge: Pick<BridgeCore, 'stop'>): Promise<void> => {
	await Promise.resolve()
		.then(() => bridge.stop())
		.catch((error: unknown) => {
			console.error('access_control.bridge_stop_failed', error instanceof Error ? error.message : String(error));
		});
};

/**
 * Verifies every loaded catalogue against its index, which registers every catalogue with the bridge,
 * then starts the bridge, before the image listens. A verification's refusal is logged as
 * `access_control.startup_refused`. A bridge failing to start is stopped, and the start's own error is
 * rejected with once the stop has settled, so none of the bridge's work outlives the refused startup.
 *
 * @param indices each loaded catalogue's index mapping and probe, by catalogue id.
 * @param usher what `prepareUsher` returned.
 */
export const verifyAndStartUsher = async ({
	indices,
	usher,
}: {
	indices: Readonly<Record<string, CatalogueIndex>>;
	usher: ImageUsher;
}): Promise<void> => {
	try {
		await usher.accessControl.verify(indices);
	} catch (error) {
		console.error('access_control.startup_refused', error instanceof Error ? error.message : String(error));
		throw error;
	}

	try {
		await usher.bridge.start();
	} catch (error) {
		await stopUsherBridge(usher.bridge);
		throw error;
	}
};
