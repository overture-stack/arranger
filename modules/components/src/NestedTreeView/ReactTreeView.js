import React from 'react';

class TreeView extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: props.defaultCollapsed,
    };
  }

  handleClick = (...args) => {
    this.setState({ collapsed: !this.state.collapsed });
    if (this.props.onClick) {
      this.props.onClick(...args);
    }
  };

  render() {
    const {
      collapsed = this.state.collapsed,
      className = '',
      itemClassName = '',
      treeViewClassName = '',
      childrenClassName = '',
      nodeLabel = '',
      children,
      defaultCollapsed,
      renderArrow = ({ props, state }) => {},
      ...rest
    } = this.props;

    let arrowClassName = 'tree-view_arrow';
    let containerClassName = 'tree-view_children';
    if (collapsed) {
      arrowClassName += ' tree-view_arrow-collapsed';
      containerClassName += ' tree-view_children-collapsed';
    }

    const arrow = renderArrow({
      props: { ...rest, className: className + ' ' + arrowClassName },
      state: this.state,
      handleClick: this.handleClick,
    }) || (
      <div
        {...rest}
        className={className + ' ' + arrowClassName}
        onClick={this.handleClick}
      />
    );

    return (
      <div className={'tree-view ' + treeViewClassName}>
        <div className={'tree-view_item ' + itemClassName}>
          {arrow}
          {nodeLabel({ open: this.handleClick })}
        </div>
        <div className={containerClassName + ' ' + childrenClassName}>
          {collapsed ? null : children}
        </div>
      </div>
    );
  }
}

export default TreeView;
