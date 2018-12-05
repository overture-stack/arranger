import * as React from 'react';
import { connect } from 'react-redux';
import Table, { TableCell } from 'mineral-ui/Table';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Checkbox from 'mineral-ui/Checkbox';

import SelectableTableRow from 'src/components/SelectableTableRow';
import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxDispatchProps,
  IReduxExternalProps,
  IReduxStateProps,
} from './ReduxContainer';
import QuicksearchFieldConfigEditor from './QuicksearchFieldConfigEditor';

export default connect(mapStateToProps, mapDispatchToProps)(
  (props: IReduxStateProps & IReduxDispatchProps & IReduxExternalProps) => {
    const { graphqlField, quicksearchConfigs, onFieldPropertyChange } = props;

    const [selectedField, setSelectedField] = React.useState(
      quicksearchConfigs[0].field,
    );

    const fieldTableColumns: Array<{
      content: string;
      key: keyof typeof quicksearchConfigs[0];
    }> = [
      { content: `Active`, key: 'isActive' },
      { content: `Fields (${quicksearchConfigs.length})`, key: 'field' },
    ];

    const onFieldTableRowClick = (field: string) => () =>
      setSelectedField(field);

    const onActiveStateChange = entry => () => {
      onFieldPropertyChange({ ...entry, isActive: !entry.isActive });
    };

    return (
      <Grid alignItems="top" columns={12}>
        <GridItem span={7}>
          <Table
            title={`Entity fields`}
            hideTitle={true}
            rowKey="field"
            columns={fieldTableColumns}
            data={quicksearchConfigs.map(entry => {
              const selected = selectedField === entry.field;
              return {
                selected,
                row: props => {
                  return (
                    <SelectableTableRow
                      selected={selected}
                      onClick={onFieldTableRowClick(entry.field)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={entry.isActive}
                          onChange={onActiveStateChange(entry)}
                        />
                      </TableCell>
                      <TableCell>
                        {entry.field && entry.field.length
                          ? entry.displayName
                          : graphqlField}
                      </TableCell>
                    </SelectableTableRow>
                  );
                },
              };
            })}
          />
        </GridItem>
        <GridItem span={5}>
          <QuicksearchFieldConfigEditor
            field={selectedField}
            graphqlField={graphqlField}
          />
        </GridItem>
      </Grid>
    );
  },
);
