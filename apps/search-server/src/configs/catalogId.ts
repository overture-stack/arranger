import crypto from 'crypto';
import path from 'path';

import type { ConfigsObject as ArrangerConfigs } from '@overture-stack/arranger-types/configs';
import { configRootProperties } from '@overture-stack/arranger-types/configs/constants';

const hashId = (value: string) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);

export const resolveCatalogId = ({
	aggregatedConfigs,
	configsPath,
	usedIds,
}: {
	aggregatedConfigs: Partial<ArrangerConfigs>;
	configsPath: string;
	usedIds: Set<string>;
}) => {
	const folderName = path.basename(configsPath);
	const requestedId = aggregatedConfigs[configRootProperties.CATALOG_ID];
	const baseId = requestedId || (!['config', 'configs'].includes(folderName) && folderName);
	const finalBaseId = baseId || `catalog-${hashId(configsPath)}`;

	if (!usedIds.has(finalBaseId)) {
		usedIds.add(finalBaseId);
		return finalBaseId;
	}

	const dedupedId = `${finalBaseId}-${hashId(`${finalBaseId}:${configsPath}`)}`;
	usedIds.add(dedupedId);
	return dedupedId;
};
