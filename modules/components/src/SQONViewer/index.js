import { css } from '@emotion/react';
import cx from 'classnames';
import { take } from 'lodash';

import { withData } from '@/DataContext';
import { useThemeContext } from '@/ThemeContext';
import noopFn, { emptyObj } from '@/utils/noops';

import EmptyMessage from './EmptyMessage';
import { Op, SQONGroup, SQONValueGroup, SQONWrapper, useDataBubbles } from './helpers';
import { toggleSQON, replaceFilterSQON } from './utils';

/**
 * @param {GroupSQONInterface} sqon
 */
const SQONViewer = ({
	dateFormat = undefined,
	emptyMessage = 'Start by selecting filters',
	onClear = noopFn,
	setSQON = noopFn,
	sqon = null, // : GroupSQONInterface;
	translateSQONValue = undefined,
	valueCharacterLimit = undefined,
}) => {
	const {
		components: {
			SQONViewer: {
				SQONGroup: themeSQONGroupProps = emptyObj,
				SQONOp: themeSQONOpProps = emptyObj,
				SQONValueGroup: themeSQONVaueGroupProps = emptyObj,
				SQONWrapper: themeSQONWrapperProps = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'SQONViewer' });
	const sqonContent = sqon?.content || [];
	const isEmpty = sqonContent.length === 0;
	const { Clear, FieldNameCrumb, isExpanded, LessOrMore, ValueCrumb } = useDataBubbles({
		dateFormat,
		onClear,
		setSQON,
		translateSQONValue,
		valueCharacterLimit,
	});

	return (
		<SQONWrapper
			className={cx('sqon-view', { 'sqon-view-empty': isEmpty })}
			{...themeSQONWrapperProps}
		>
			{isEmpty ? (
				<EmptyMessage message={emptyMessage} />
			) : (
				<>
					<Clear nextSQON={null} />

					{sqonContent.map((valueSQON, index) => {
						const {
							op,
							content: { fieldName, fieldNames, entity },
						} = valueSQON;

						const value = [].concat(valueSQON.content.value || []);
						const hasMultipleValues = value.length > 1;
						const valuesToDisplay = isExpanded(valueSQON) ? value : take(value, 2);

						return (
							<SQONGroup
								css={css`
									min-height: 1.2em;
									margin: 0.1rem 0;
									width: fit-content;
								`}
								key={`${fieldName || fieldNames?.join()}.${op}.${value.join()}`}
								{...themeSQONGroupProps}
							>
								{FieldNameCrumb({
									fieldName: op === 'filter' ? (entity ? `${entity}.${op}` : op) : fieldName,
								})}

								<Op
									css={css`
										margin-right: 0.3rem;
									`}
									{...themeSQONOpProps}
								>
									{(op === 'in' && hasMultipleValues) || op !== 'in' ? op : 'is'}
								</Op>

								{hasMultipleValues && (
									<SQONValueGroup className="sqon-value-group-start" {...themeSQONVaueGroupProps}>
										(
									</SQONValueGroup>
								)}

								{valuesToDisplay.map((value) =>
									ValueCrumb({
										className: cx({ 'sqon-value-single': !hasMultipleValues }),
										fieldName,
										key: value,
										nextSQON:
											op === 'filter'
												? replaceFilterSQON(
														{
															op: 'and',
															content: [
																{
																	op: op,
																	content: {
																		...(entity && { entity }),
																	},
																},
															],
														},
														sqon,
												  )
												: toggleSQON(
														{
															op: 'and',
															content: [
																{
																	op: op,
																	content: {
																		fieldName,
																		value,
																	},
																},
															],
														},
														sqon,
												  ),
										value,
									}),
								)}

								{hasMultipleValues && value.length > 2 && <LessOrMore valueSQON={valueSQON} />}

								{hasMultipleValues && (
									<SQONValueGroup className="sqon-value-group-end" {...themeSQONVaueGroupProps}>
										)
									</SQONValueGroup>
								)}

								{
									// show Operation only if there's other SQON values after this one.
									index < sqonContent.length - 1 && <Op {...themeSQONOpProps}>{sqon?.op}</Op>
								}
							</SQONGroup>
						);
					})}
				</>
			)}
		</SQONWrapper>
	);
};

export default withData(SQONViewer);

export const CurrentSQON = (props) => {
	console.warn(
		'Arranger deprecation warning --\n This component has been renamed to `SQONViewer` for declarativeness. ' +
			'Please update your integration accordingly to prevent errors, ' +
			'as the old name will be deprecated in a future Arranger version.',
	);

	return <SQONViewer {...props} />;
};

export const SQONView = CurrentSQON;

export { Bubble, FieldName, Op, SQONGroup, SQONWrapper, useDataBubbles, Value } from './helpers';
