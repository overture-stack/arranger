import crypto from 'crypto';

import type { ConfigsObject as ArrangerConfigs } from '@overture-stack/arranger-types/configs';
import { rootConfigProperties } from '@overture-stack/arranger-types/configs/constants';

const hashId = (value: string) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);

export const resolveCatalogId = ({
	config,
	folderName,
	usedIds,
	seed,
}: {
	config: Partial<ArrangerConfigs>;
	folderName: string;
	usedIds: Set<string>;
	seed: string;
}) => {
	const requestedId = config[rootConfigProperties.INSTANCE_ID];
	const baseId = requestedId || (!['config', 'configs'].includes(folderName) && folderName);
	const finalBaseId = baseId || `catalog-${hashId(seed)}`;

	if (!usedIds.has(finalBaseId)) {
		usedIds.add(finalBaseId);
		return finalBaseId;
	}

	const dedupedId = `${finalBaseId}-${hashId(`${finalBaseId}:${seed}`)}`;
	usedIds.add(dedupedId);
	return dedupedId;
};
