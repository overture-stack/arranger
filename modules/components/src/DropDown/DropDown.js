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
  handleToggleMenu = () => {
    this.setState(({ isOpen }) => ({ isOpen: !isOpen }));
  };
  handleStateChange = changes => {
    const { isOpen, type } = changes;
    if (type === Downshift.stateChangeTypes.mouseUp) {
      this.setState({ isOpen });
    }
  };
  render() {
    const { isOpen } = this.state;
    const {
      items,
      onChange,
      itemToString,
      children,
      align = 'right',
    } = this.props;

    return (
      <Downshift
        itemToString={itemToString}
        onChange={onChange}
        selectedItem={items.filter(item => item.show)}
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
              {...getButtonProps({ onClick: this.handleToggleMenu })}
            >
              <div className="dropDownButtonContent">{children}</div>
              <ArrowIcon isOpen={isOpen} />
            </button>
            {!isOpen ? null : (
              <div
                className="dropDownContent"
                style={{
                  right: align === 'right' ? 0 : 'auto',
                  left: align === 'right' ? 'auto' : 0,
                }}
              >
                {items.map((item, index) => (
                  <div
                    className="dropDownContentElement"
                    key={item.id || itemToString(item)}
                    {...getItemProps({ item, index })}
                  >
                    {itemToString(item)}
                    <input
                      readOnly
                      type="checkbox"
                      checked={selectedItem.indexOf(item) > -1}
                      aria-label={`Select column ${item.id ||
                        itemToString(item)}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Downshift>
    );
  }
}

export default DropDown;
