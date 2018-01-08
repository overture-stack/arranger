import React from 'react';
import Dragula from 'dragula';
import { isEqual } from 'lodash';

export default Component => {
  const wrapper = class RTDragColumnTable extends React.Component {
    constructor(props) {
      super(props);

      this.state = {
        columns: props.columns,
      };
    }
    componentWillReceiveProps(nextProps) {
      if (!isEqual(nextProps.columns, this.props.columns)) {
        this.setState({ columns: nextProps.columns });
      }
    }
    render() {
      const { ...rest } = this.props;

      const extra = {
        TrComponent: ({ children, className, ...rest }) => (
          <div ref={this.dragulaDecorator} className={'rt-tr'} {...rest}>
            {children}
          </div>
        ),
        getTheadThProps: (state, rowInfo, column, instance) => {
          return {
            'data-accessor': column.id,
          };
        },
        columns: this.state.columns,
      };

      return <Component {...rest} {...extra} />;
    }
    dragulaDecorator = componentBackingInstance => {
      if (componentBackingInstance) {
        let options = {
          moves: function(el, container, handle) {
            return el.attributes.getNamedItem('data-accessor') != null;
          },
        };

        const drake = Dragula([componentBackingInstance], options);

        drake.on('drop', (el, target, source, sibling) => {
          const movedColumnId = el.attributes.getNamedItem('data-accessor')
            .value;
          let movedColumn;

          let newColumnsOrder = this.state.columns.filter(column => {
            if (
              column.accessor === movedColumnId ||
              column.id === movedColumnId
            ) {
              movedColumn = column;
              return false;
            }
            return true;
          });

          if (sibling) {
            const siblingColumnId = sibling.attributes.getNamedItem(
              'data-accessor',
            ).value;

            const siblingColumn = newColumnsOrder.filter(
              col =>
                col.accessor === siblingColumnId || col.id === siblingColumnId,
            )[0];

            const siblingColumnIndex = newColumnsOrder.indexOf(siblingColumn);

            newColumnsOrder.splice(siblingColumnIndex, 0, movedColumn);
          } else {
            newColumnsOrder.push(movedColumn);
          }

          this.setState({ columns: newColumnsOrder });
        });
      }
    };
  };
  return wrapper;
};
