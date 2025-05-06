import Component from '@reach/component-component';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { Tooltip } from 'react-tippy';
import 'react-tippy/dist/tippy.css';

import defaultApiFetcher from '#utils/api.js';
import ClickAwayListener from '#utils/ClickAwayListener.js';

import FieldOpModifier from '../filterComponents/index.js';
import { DisplayNameMapContext, getOperationAtPath, FIELD_OP_DISPLAY_NAME, RANGE_OPS } from '../utils.js';

import { PillRemoveButton } from './common.js';

const FieldOp = (props) => {
	const {
		onSqonChange = (fullSqon) => { },
		onContentRemove = () => { },
		fullSyntheticSqon,
		sqonPath = [],
		opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
		arrangerIndex,
		FieldOpModifierContainer = undefined,
		apiFetcher = defaultApiFetcher,
		getActiveExecutableSqon,
	} = props;

	const fieldOpObj = getOperationAtPath(sqonPath)(fullSyntheticSqon);
	const {
		op,
		content: { field, value },
	} = fieldOpObj;
	const initialState = { isOpen: false };
	const onClickAway = (s) => () => {
		s.setState({ isOpen: false });
	};
	const toggleDropdown = (s) => () => s.setState({ isOpen: !s.state.isOpen });
	const onRemoveClick = () => {
		onContentRemove(fieldOpObj);
	};
	const onNewSqonSubmitted = (s) => (newSqon) => {
		onSqonChange(newSqon);
		toggleDropdown(s)();
	};
	return (
		<Component initialState={initialState}>
			{(s) => (
				<DisplayNameMapContext.Consumer>
					{(fieldDisplayNameMap = {}) => (
						<span className={`fieldOp pill`}>
							<span className={'opContainer'}>
								<span className={`fieldName`}>{fieldDisplayNameMap[field] || field} </span>
								<span className={`opName`}>{` is ${(Array.isArray(value) && value.length > 1) || RANGE_OPS.includes(op) ? opDisplayNameMap[op] : ''
									} `}</span>
							</span>
							<ClickAwayListener className={'selectionContainer'} handler={onClickAway(s)}>
								<span className={'valueDisplay'} onClick={toggleDropdown(s)}>
									<Tooltip position="bottom" html={Array.isArray(value) ? value.join(', ') : value}>
										{Array.isArray(value) ? value.join(', ') : value}{' '}
									</Tooltip>
								</span>
								<span onClick={toggleDropdown(s)}>
									<span style={{ pointerEvents: 'none' }}>{s.state.isOpen ? <FaChevronUp /> : <FaChevronDown />}</span>
								</span>
								{s.state.isOpen && (
									<div className={`fieldFilterContainer`}>
										<FieldOpModifier
											arrangerIndex={arrangerIndex}
											field={field}
											sqonPath={sqonPath}
											initialSqon={fullSyntheticSqon}
											onSubmit={onNewSqonSubmitted(s)}
											onCancel={toggleDropdown(s)}
											fieldDisplayNameMap={fieldDisplayNameMap}
											opDisplayNameMap={opDisplayNameMap}
											ContainerComponent={FieldOpModifierContainer}
											getExecutableSqon={getActiveExecutableSqon}
											apiFetcher={apiFetcher}
										/>
									</div>
								)}
							</ClickAwayListener>
							<PillRemoveButton onClick={onRemoveClick} />
						</span>
					)}
				</DisplayNameMapContext.Consumer>
			)}
		</Component>
	);
};

export default FieldOp;
