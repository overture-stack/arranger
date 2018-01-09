import React from 'react';
import Downshift from 'downshift';

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
    const { items, onChange, itemToString, children } = this.props;

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
          <div
            style={{
              display: 'inline-block',
              position: 'relative',
              whiteSpace: 'nowrap',
              zIndex: 999,
            }}
          >
            <button
              style={{ display: 'flex', cursor: 'pointer' }}
              {...getButtonProps({ onClick: this.handleToggleMenu })}
            >
              <div style={{ marginRight: 8 }}>{children}</div>
              <ArrowIcon isOpen={isOpen} />
            </button>
            {!isOpen ? null : (
              <div
                style={{
                  position: 'absolute',
                  background: 'white',
                  minWidth: '100%',
                  zIndex: 1,
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  padding: 5,
                }}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id || itemToString(item)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 5,
                    }}
                    {...getItemProps({
                      item,
                      index,
                    })}
                  >
                    {itemToString(item)}
                    <input
                      readOnly
                      type="checkbox"
                      checked={selectedItem.indexOf(item) > -1}
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
