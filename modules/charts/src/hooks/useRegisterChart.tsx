import { useChartsContext } from '#components/Provider/Provider';
import { useEffect } from 'react';

export const useRegisterChart = ({ fieldNames }) => {
	const { registerChart, deregisterChart } = useChartsContext();

	useEffect(() => {
		try {
			registerChart({ fieldNames });
		} catch (e) {
			console.error(`Cannot register ${fieldNames} with Arranger Charts provider.`);
			console.error(e);
		}
		return () => {
			deregisterChart({ fieldNames });
		};
	}, [registerChart, deregisterChart, fieldNames]);
};
