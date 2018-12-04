import * as React from 'react';
import { connect } from 'react-redux';
import Table, { TableCell } from 'mineral-ui/Table';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Card, { CardTitle, CardBlock, CardDivider } from 'mineral-ui/Card';
import Checkbox from 'mineral-ui/Checkbox';

import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxDispatchProps,
  IReduxExternalProps,
  IReduxStateProps,
} from './ReduxContainer';
import SelectableTableRow from 'src/components/SelectableTableRow';

interface IQuicksearchFieldConfigEditorExternalProps
  extends IReduxExternalProps {
  field: string;
}
const QuicksearchFieldConfigEditor = connect(
  mapStateToProps,
  mapDispatchToProps,
)(
  (
    props: IReduxStateProps &
      IReduxExternalProps &
      IQuicksearchFieldConfigEditorExternalProps,
  ) => {
    const { field, graphqlField, quicksearchConfigs } = props;
    const editingField = quicksearchConfigs.find(f => f.field === field);
    if (!editingField) {
      return null;
    }
    type TDataProperty = keyof typeof editingField;
    interface IFieldPropertyDelta {
      property: TDataProperty;
      value: (typeof editingField)[IFieldPropertyDelta['property']];
    }
    const onFieldPropertyChange = (delta: IFieldPropertyDelta) => () => {};
    return (
      <Card>
        <CardTitle>{field && field.length ? field : graphqlField}</CardTitle>
        <CardBlock>
          <Checkbox
            name="Active"
            label="Active"
            checked={editingField.isActive}
            onChange={onFieldPropertyChange({
              property: 'isActive',
              value: !editingField.isActive,
            })}
          />
        </CardBlock>
      </Card>
    );
  },
);

export default connect(mapStateToProps)(
  (props: IReduxStateProps & IReduxExternalProps) => {
    const { graphqlField, quicksearchConfigs } = props;

    const [selectedField, setSelectedField] = React.useState(
      quicksearchConfigs[0].field,
    );

    const fieldTableColumns = [
      {
        content: `Fields (${quicksearchConfigs.length})`,
        key: 'field',
      },
    ];

    const onFieldTableRowClick = (field: string) => () =>
      setSelectedField(field);

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
                        {entry.field && entry.field.length
                          ? entry.field
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
