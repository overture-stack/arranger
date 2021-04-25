import React from 'react';
import Downshift from 'downshift';
import './DropDown.css';

function ArrowIcon({ isOpen }) {
  return (
    <svg
      viewBox="0 0 20 20"
      preserveAspectRatio="none"
      width={16}
      fill="transparent"
      stroke="#979797"
      strokeWidth="1.1px"
      transform={isOpen ? 'rotate(180)' : null}
    >
      <path d="M1,6 L10,15 L19,6" />
    </svg>
  );
}

class DropDown extends React.Component {
  state = { isOpen: false };
  handleToggleMenu = (event) => {
    event.target?.attributes?.disabled || this.setState(({ isOpen }) => ({ isOpen: !isOpen }));
  };
  handleStateChange = (changes) => {
    const { isOpen, type } = changes;
    if (type === Downshift.stateChangeTypes.mouseUp) {
      this.setState({ isOpen });
    }
  };

  render() {
    const { isOpen } = this.state;
    const {
      hasSelectedRows,
      items,
      onChange = () => {},
      itemToString,
      children,
      align = 'right',
      singleSelect = false,
    } = this.props;

    const disableDownloads =
      items.every((item) => item.exporterRequiresRowSelection) && !hasSelectedRows;

    return (
      <Downshift
        itemToString={itemToString}
        onChange={onChange}
        selectedItem={items.filter((item) => item.show)}
        isOpen={isOpen}
        onStateChange={this.handleStateChange}
      >
        {({
          getInputProps,
          getButtonProps,
          getItemProps,
          isOpen,
          toggleMenu,
          clearSelection,
          selectedItem,
          inputValue,
          highlightedIndex,
        }) => (
          <div className="dropDownHeader">
            <button
              aria-label={`Show columns to select`}
              className="dropDownButton"
              {...getButtonProps({
                disabled: disableDownloads,
                onClick: this.handleToggleMenu,
              })}
            >
              <div className="dropDownButtonContent">{children}</div>
              <ArrowIcon isOpen={isOpen} />
            </button>
            {isOpen && (
              <div
                className={`dropDownContent ${singleSelect ? 'single' : 'multiple'}`}
                style={{
                  right: align === 'right' ? 0 : 'auto',
                  left: align === 'right' ? 'auto' : 0,
                }}
                {...(singleSelect && { onClick: this.handleToggleMenu })}
              >
                {items.map((item, index) => {
                  const { id, ...itemProps } = getItemProps({
                    item,
                    index,
                    disabled: item.exporterRequiresRowSelection && !hasSelectedRows,
                  });
                  const label = itemToString(item);
                  const labelIsComponent = React.isValidElement(label);
                  return (
                    <div
                      className={`dropDownContentElement${
                        labelIsComponent ? ' custom' : ' clickable'
                      }`}
                      key={item.id || id}
                      {...itemProps}
                    >
                      {label}
                      {!(singleSelect || labelIsComponent) && (
                        <input
                          readOnly
                          type="checkbox"
                          checked={selectedItem.indexOf(item) > -1}
                          aria-label={`Select column ${
                            item.id || (typeof label === 'string' ? label : id)
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Downshift>
    );
  }
}

export default DropDown;
