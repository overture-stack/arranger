import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

const getDefaultServerSideFilter: GetServerSideFilterFn = () => ({
	op: 'not',
	content: [],
});

export default getDefaultServerSideFilter;
