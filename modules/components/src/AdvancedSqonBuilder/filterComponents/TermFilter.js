import React from 'react';
import Component from 'react-component-component';
import { sortBy } from 'lodash';
import './FilterContainerStyle.css';
import {
  getOperationAtPath,
  setSqonAtPath,
  FIELD_OP_DISPLAY_NAME,
} from '../utils';
import { TermAgg } from '../../Aggs';
import TextFilter from '../../TextFilter';
import { inCurrentSQON } from '../../SQONView/utils';
import { FilterContainer } from './common';

const TermAggsWrapper = ({ children }) => (
  <div className="aggregation-card">{children}</div>
);

const termFilterOpOptions = ['in', 'not-in'];

export const TermFilterUI = ({
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  ContainerComponent = FilterContainer,
  InputComponent = TextFilter,
  sqonPath = [],
  buckets = mockBuckets,
  fieldDisplayNameMap = {},
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
}) => {
  /**
   * initialFieldSqon: {
   *  op: "in" | ">=" | "<=",
   *  content: {
   *    field: string,
   *    value: string,
   *  }
   * }
   */
  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon);
  const initialState = { searchString: '', localSqon: initialSqon };
  const onSearchChange = s => e => {
    s.setState({ searchString: e.value });
  };
  const isFilterActive = s => d =>
    inCurrentSQON({
      value: d.value,
      dotField: d.field,
      currentSQON: getOperationAtPath(sqonPath)(s.state.localSqon),
    });
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
  const computeBuckets = (s, buckets) =>
    sortBy(
      buckets,
      bucket =>
        !inCurrentSQON({
          value: bucket.key,
          dotField: initialFieldSqon.content.field,
          currentSQON: getOperationAtPath(sqonPath)(initialSqon),
        }),
    ).filter(({ key }) => key.includes(s.state.searchString));
  const onOptionTypeChange = s => e => {
    const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        op: e.target.value,
      })(s.state.localSqon),
    });
  };
  const onSelectAllClick = s => () => {
    const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: buckets.map(({ key }) => key),
        },
      })(s.state.localSqon),
    });
  };
  const onClearClick = s => () => {
    const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [],
        },
      })(s.state.localSqon),
    });
  };
  const onFilterClick = s => ({ generateNextSQON }) => {
    setTimeout(() => {
      // state change in the same tick somehow results in this component dismounting (probably  something to do with TermAgg's click event, needs investigation)
      const deltaSqon = generateNextSQON();
      const deltaFiterObjContentValue = deltaSqon.content[0].content.value;
      // we're only interested in the new field operation's content value
      const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
      const existingValue = (currentFieldSqon.content.value || []).find(v =>
        deltaFiterObjContentValue.includes(v),
      );
      const newFieldSqon = {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [
            ...(currentFieldSqon.content.value || []).filter(
              v => v !== existingValue,
            ),
            ...(existingValue ? [] : deltaFiterObjContentValue),
          ],
        },
      };
      s.setState({
        localSqon: setSqonAtPath(sqonPath, newFieldSqon)(s.state.localSqon),
      });
    }, 0);
  };
  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <div className="contentSection">
            <span>
              {fieldDisplayNameMap[initialFieldSqon.content.field] ||
                initialFieldSqon.content.field}
            </span>{' '}
            is{' '}
            <span className="select">
              <select onChange={onOptionTypeChange(s)}>
                {termFilterOpOptions.map(option => (
                  <option key={option} value={option}>
                    {opDisplayNameMap[option]}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="contentSection searchInputContainer">
            <InputComponent
              value={s.state.searchString}
              onChange={onSearchChange(s)}
            />
          </div>
          <div className="contentSection termFilterActionContainer">
            <span
              className={`aggsFilterAction selectAll`}
              onClick={onSelectAllClick(s)}
            >
              Select All
            </span>
            <span
              className={`aggsFilterAction clear`}
              onClick={onClearClick(s)}
            >
              Clear
            </span>
          </div>
          <div className="contentSection termAggContainer">
            <TermAgg
              WrapperComponent={TermAggsWrapper}
              field={initialFieldSqon.content.field}
              displayName="Disease Type"
              buckets={computeBuckets(s, buckets)}
              handleValueClick={onFilterClick(s)}
              isActive={isFilterActive(s)}
              maxTerms={5}
            />
          </div>
        </ContainerComponent>
      )}
    </Component>
  );
};

const mockTermBuckets = [
  { doc_count: 2, key: 'GF_9V1MT6CM' },
  { doc_count: 10, key: 'Cancer' },
  { doc_count: 10, key: 'Acute Myeloid Leukemia' },
  {
    doc_count: 10,
    key: 'Abnormality of nervous system physiology (HP:0012638)',
  },
  { doc_count: 10, key: 'Ewing Sarcoma: Genetic Risk' },
  { doc_count: 10, key: 'Pediatric Brain Tumors: CBTTC' },

  { doc_count: 10, key: 'assdfgsdgf' },
  { doc_count: 10, key: 'dhgsd' },
  { doc_count: 10, key: 's;obdfu' },
  { doc_count: 10, key: 'eht;dfnvx' },
  { doc_count: 10, key: ';uegrsndvdfsd' },
  { doc_count: 10, key: 'oisegrbfv' },
  { doc_count: 10, key: '45oihesgdlknv' },
  { doc_count: 10, key: 'oisheglsknvd' },
];

export default ({ children, ...rest }) => (
  <TermFilterUI buckets={mockTermBuckets} {...rest}>
    {children}
  </TermFilterUI>
);
