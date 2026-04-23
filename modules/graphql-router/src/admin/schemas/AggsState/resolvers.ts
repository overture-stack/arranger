import { type GraphQLResolveInfo } from 'graphql';

import { type IQueryContext } from '../../types.js';
import { type Resolver } from '../types.js';

import { type I_AggsSetState, type I_AggsStateQueryInput, type I_SaveAggsStateMutationInput } from './types.js';
import { getAggsSetState, saveAggsSetState } from './utils.js';

const saveAggsStateMutationResolver: Resolver<I_AggsSetState, I_SaveAggsStateMutationInput> = async (
	obj: object,
	args,
	{ es }: IQueryContext,
	info: GraphQLResolveInfo,
): Promise<I_AggsSetState> => {
	return await saveAggsSetState(es)(args);
};

const aggsStateQueryResolver: Resolver<I_AggsSetState, I_AggsStateQueryInput> = (
	obj: object,
	args,
	{ es }: IQueryContext,
	info: GraphQLResolveInfo,
): Promise<I_AggsSetState> => {
	return getAggsSetState(es)(args);
};

export default {
	Query: {
		aggsState: aggsStateQueryResolver,
	},
	Mutation: {
		saveAggsState: saveAggsStateMutationResolver,
	},
};
