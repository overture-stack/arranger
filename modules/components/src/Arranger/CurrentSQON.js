import { useCallback } from 'react';
import { truncate } from 'lodash';
import { format } from 'date-fns';

import SQONView, { Value, Bubble, Field } from '@/SQONView';
import noopFn from '@/utils/noopFns';
import internalTranslateSQONValue from '@/utils/translateSQONValue';
import { useDataContext } from '@/DataContext';

export const CurrentSQON = ({
  dateFormat = 'yyyy-MM-dd',
  emptyMessage = undefined,
  onClear = noopFn,
  setSQON,
  sqon,
  translateSQONValue = (x) => x,
  valueCharacterLimit = 30,
}) => {
  const { extendedMapping } = useDataContext();

  const findExtendedMappingField = useCallback(
    (wantedField) => extendedMapping?.find((mapping) => mapping.field === wantedField),
    [extendedMapping],
  );

  return (
    <SQONView
      emptyMessage={emptyMessage}
      sqon={sqon}
      FieldCrumb={({ field, nextSQON, ...fieldProps }) => (
        <Field {...{ field, ...fieldProps }}>
          {findExtendedMappingField(field)?.displayName || field}
        </Field>
      )}
      ValueCrumb={({ field, value, nextSQON, ...valueProps }) => (
        <Value onClick={() => setSQON(nextSQON)} {...valueProps}>
          {truncate(
            translateSQONValue(
              internalTranslateSQONValue(
                (findExtendedMappingField(field)?.type === 'date' && format(value, dateFormat)) ||
                  (findExtendedMappingField(field)?.displayValues || {})[value] ||
                  value,
              ),
            ),
            { length: valueCharacterLimit || Infinity },
          )}
        </Value>
      )}
      Clear={({ nextSQON }) => (
        <Bubble
          className="sqon-clear"
          onClick={() => {
            onClear();
            setSQON(nextSQON);
          }}
        >
          Clear
        </Bubble>
      )}
    />
  );
};

export default CurrentSQON;
