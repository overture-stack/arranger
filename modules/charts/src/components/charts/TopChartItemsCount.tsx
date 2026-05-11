const TopChartItemsCount = ({items, total}: {items: number; total: number}) => {
  return (
    <div style={{
				position: 'absolute',
				top: '0.625rem',
				right: '0.625rem',
				width: '100%',
				height: '1.375rem',
        background: '#E5E7EB',
        fontSize: '0.6875rem',
        color: '#000000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0.25rem',
        borderRadius: '0.25rem',
			}}
    >{`Top ${items} of ${total}`}</div>);
}

export default TopChartItemsCount;