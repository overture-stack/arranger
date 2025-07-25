import { useChartsContext } from '#components/Provider/Provider';
import { useEffect } from 'react';

export const useRegisterChart = ({ fieldName }) => {
	const { registerChart, deregisterChart } = useChartsContext();

	useEffect(() => {
		try {
			registerChart({ fieldName });
		} catch (e) {
			console.error(`Cannot register chart ${fieldName} with Arranger Charts provider.`);
			console.error(e);
		}
		return () => {
			deregisterChart({ fieldName });
		};
	}, [registerChart, deregisterChart, fieldName]);
};
