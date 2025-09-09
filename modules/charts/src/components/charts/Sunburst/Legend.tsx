import { css } from '@emotion/react';

export const Legend = ({ data, colorMap }: { data: { label: string }[] }) => {
	return (
		<div
			css={css({
				display: 'flex',
				flexDirection: 'column',
				flexWrap: 'wrap',
				columnGap: '8px',
				'> div:not(:first-child)': { marginTop: '16px' },
			})}
		>
			{data.map((legend, index) => {
				return (
					<div
						css={css({ display: 'flex', flexDirection: 'row', alignItems: 'center' })}
						key={`${legend.label}_${index}`}
					>
						<div
							css={css({
								width: '12px',
								height: '12px',
								backgroundColor: colorMap.get(legend.label) || 'black',
								marginRight: '8px',
							})}
						/>
						<span css={css({ fontSize: '10px', fontWeight: 400 })}>{legend.label}</span>
					</div>
				);
			})}
		</div>
	);
};
