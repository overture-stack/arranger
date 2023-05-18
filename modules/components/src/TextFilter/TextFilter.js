import { FaSearch } from 'react-icons/fa';

import TextInput from '@/Input';
import { replaceFilterSQON } from '@/SQONViewer/utils';
import noopFn, { emptyObj } from '@/utils/noops';

export const generateNextSQON =
	(value) =>
	({ sqon, fieldNames, entity }) =>
		replaceFilterSQON(
			{
				op: 'and',
				content: [
					{
						op: 'filter',
						content: {
							fieldNames,
							value,
							...(entity && { entity }),
						},
					},
				],
			},
			sqon,
		);

const TextFilter = ({
	onChange = noopFn,
	theme: {
		altText = `Data filter`,
		Component = TextInput,
		disabled: customDisabled,
		leftIcon = { Icon: FaSearch },
		placeholder = 'Filter',
		showClear = true,
		...theme
	} = emptyObj,
	...props
}) => {
	const handleChange = ({ target: { value = '' } = {} } = {}) => {
		onChange({
			value,
			generateNextSQON: generateNextSQON(value),
		});
	};

	return (
		<Component
			disabled={customDisabled}
			onChange={handleChange}
			theme={{
				altText,
				leftIcon,
				placeholder,
				showClear,
				...theme,
			}}
			type="text"
			{...props}
		/>
	);
};

export default TextFilter;
