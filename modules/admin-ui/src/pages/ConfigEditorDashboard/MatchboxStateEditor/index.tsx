import * as React from 'react';
import { connect } from 'react-redux';
import Component from 'react-component-component';
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

    const initialState: { selectdField: string } = {
      selectdField: quicksearchConfigs[0].field,
    };

    const fieldTableColumns: Array<{
      content: string;
      key: keyof typeof quicksearchConfigs[0];
    }> = [
      { content: `Active`, key: 'isActive' },
      { content: `Fields (${quicksearchConfigs.length})`, key: 'field' },
    ];

    const onFieldTableRowClick = s => (field: string) => () =>
      s.setState({
        selectedField: field,
      });

    const onActiveStateChange = entry => () => {
      onFieldPropertyChange({ ...entry, isActive: !entry.isActive });
    };

    return (
      <Component initialState={initialState}>
        {s => (
          <Grid alignItems="top" columns={12}>
            <GridItem span={7}>
              <Table
                title={`Entity fields`}
                hideTitle={true}
                rowKey="field"
                columns={fieldTableColumns}
                data={quicksearchConfigs.map(entry => {
                  const selected = s.state.selectedField === entry.field;
                  return {
                    selected,
                    row: props => {
                      return (
                        <SelectableTableRow
                          selected={selected}
                          onClick={onFieldTableRowClick(s)(entry.field)}
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
                field={s.state.selectedField}
                graphqlField={graphqlField}
              />
            </GridItem>
          </Grid>
        )}
      </Component>
    );
  },
);
