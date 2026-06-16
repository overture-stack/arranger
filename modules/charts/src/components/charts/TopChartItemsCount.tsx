const TopChartItemsCount = ({ items, total }: { items: number; total: number }) => {
	return (
		<div
			className="top-chart-bar-items-count"
			style={{
				position: 'absolute',
				top: '0',
				right: '0',
				width: 'auto',
				height: '1.375rem',
				background: '#E5E7EB',
				fontSize: '0.6875rem',
				color: '#000000',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				padding: '0 0.5rem',
				borderRadius: '0.25rem',
				fontWeight: 'bold',
			}}
		>{`Top ${items} of ${total}`}</div>
	);
};

export default TopChartItemsCount;
