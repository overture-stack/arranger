import Location from '#Location.js';
import { inCurrentSQON } from '#SQONViewer/utils.js';

import AggsQuery from './AggsQuery.js';
import TermAgg from './TermAgg.js';

const AggsPanel = ({ index, aggs = [], ...props }) =>
	aggs.length ? (
		<AggsQuery
			aggs={aggs}
			documentType={index}
			render={({ data, loading }) =>
				loading ? (
					'loading'
				) : (
					<div className="remainder">
						{Object.entries(data[index].aggregations).map(([fieldName, data]) => (
							<Location
								key={fieldName}
								render={(search) => (
									<TermAgg
										fieldName={fieldName}
										buckets={data.buckets}
										isActive={(field) =>
											inCurrentSQON({
												currentSQON: (search.filters || {}).content,
												dotFieldName: field.fieldName,
												value: field.value,
											})
										}
										handleFieldClick={(d) => {
											// history.push({
											//   search: stringify({
											//     filters: JSON.stringify({
											//       op: 'and',
											//       content: [
											//         {
											//           op: 'in',
											//           content: {
											//             field: d.field,
											//             value: [d.value],
											//           },
											//         },
											//       ],
											//     }),
											//   }),
											// });
										}}
									/>
								)}
							/>
						))}
					</div>
				)
			}
			{...props}
		/>
	) : null;

export default AggsPanel;
