export const ChartText = ({ text }: { text: string }) => {
	return (
		<div
			style={{
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: '13px',
				color: '#525767',
			}}
		>
			{text}
		</div>
	);
};
