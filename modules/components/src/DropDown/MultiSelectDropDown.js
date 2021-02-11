import React, { useEffect, useRef, useState } from 'react';
import './DropDown.css';

let instances = 0;

const ArrowIcon = ({ isOpen }) => {
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
};

const CheckIcon = () => {
  return (
    <svg width={9} height={9} viewBox="0 0 8 6">
      <g fill="currentColor">
        <path
          d="M.225 4.877c-.687-.686.357-1.73 1.043-1.044L2.596 5.16l4.136-4.135c.686-.687 1.73.357 1.043 1.044L3.118 6.726c-.289.289-.756.289-1.044 0L.224 4.877z"
          transform="translate(-1105 -366) translate(0 63) translate(265 17) translate(0 237) translate(830 11) translate(0 27) translate(1 6) translate(9 4)"
        />
      </g>
    </svg>
  );
};

const ResetIcon = () => {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10">
      <g fill="currentColor">
        <path
          d="M4.874 1.252c-.039 0-.076.005-.113.013V.158c0-.144-.176-.209-.273-.112L2.8 1.75c-.065.065-.065.161-.016.226L4.488 3.68c.097.097.273.032.273-.112v-1.3c.037.008.074.013.113.013 1.844 0 3.345 1.5 3.345 3.345 0 1.844-1.5 3.345-3.345 3.345-1.844 0-3.345-1.5-3.345-3.345 0-.284-.23-.515-.514-.515-.285 0-.515.23-.515.515C.5 8.038 2.462 10 4.874 10s4.374-1.962 4.374-4.374-1.962-4.374-4.374-4.374"
          transform="translate(-1189 -364) translate(0 63) translate(265 17) translate(0 237) translate(830 11) translate(0 27) translate(1 6) translate(93 3)"
        />
      </g>
    </svg>
  );
};

export default ({
  buttonAriaLabelClosed = 'Open selection menu',
  buttonAriaLabelOpen = 'Close selection menu',
  items = [],
  defaultColumns = [],
  itemSelectionLegend = 'Select items',
  selectAllAriaLabel = 'Select all items',
  resetToDefaultAriaLabel = 'Reset to default selection',
  children,
  align = 'right',
  onChange,
  onMultipleChange,
  itemToString,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemsMap, setSelectedItemsMap] = useState(new Map());
  const [defaultColumnsMap, setDefaultColumnsMap] = useState(new Map());
  const [instanceNum, setInstanceNum] = useState(0);
  const renderRef = useRef();
  const buttonRef = useRef();
  const itemsRef = useRef([]);

  const toggle = (item) => {
    if (selectedItemsMap.get(item.field)) {
      // set to null instead of using .delete() because .delete() returns bool
      setSelectedItemsMap(new Map(selectedItemsMap.set(item.field, null)));
    } else {
      setSelectedItemsMap(new Map(selectedItemsMap.set(item.field, item)));
    }

    if (onChange) {
      onChange(item);
    }
  };

  const selectAll = () => {
    setSelectedItemsMap(
      items.reduce((map, item) => {
        map.set(item.field, item);
        return map;
      }, new Map()),
    );

    if (onMultipleChange) {
      const toggled = items
        .filter((item) => !item.show)
        .reduce((obj, item) => {
          return { ...obj, [item.field]: true };
        }, {});

      onMultipleChange(toggled);
    }
  };

  const resetToDefaults = () => {
    setSelectedItemsMap(new Map(defaultColumnsMap));

    if (onMultipleChange) {
      const toggled = items.filter((item) => {
        return (
          (item.show && !defaultColumnsMap.has(item.field)) ||
          (!item.show && defaultColumnsMap.has(item.field))
        );
      });

      const changes = toggled.reduce((obj, item) => {
        return { ...obj, [item.field]: !item.show };
      }, {});

      onMultipleChange(changes);
    }
  };

  const focusNext = (i) => {
    itemsRef.current[(i + 1) % items.length].focus();
  };

  const focusPrev = (i) => {
    itemsRef.current[(i - 1 + items.length) % items.length].focus();
  };

  const focusFirst = () => {
    itemsRef.current[0].focus();
  };

  const focusLast = () => {
    itemsRef.current[items.length - 1].focus();
  };

  const handleKeyPress = (e, i) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusNext(i);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusPrev(i);
        break;
      case 'Home':
        e.preventDefault();
        focusFirst();
        break;
      case 'End':
        e.preventDefault();
        focusLast();
        break;
      default:
        break;
    }
  };

  const handleEsc = (e) => {
    if (isOpen && e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current.focus();
    }
  };

  const handleBlur = (e) => {
    const currentTarget = e.currentTarget;
    // blur happens before click, preventing any click events in children from firing due to rerender from state change
    // so wait a tick for child component events to fire before changing open state and causing rerender
    window.setTimeout(() => {
      if (!currentTarget.contains(document.activeElement)) {
        setIsOpen(false);
      }
    }, 100);
  };

  // set defaults and selected items on initial load
  useEffect(() => {
    if (renderRef && !renderRef.current) {
      setDefaultColumnsMap(
        defaultColumns
          .filter((column) => column.field !== 'name')
          .reduce((map, item) => {
            map.set(item.field, item);
            return map;
          }, new Map()),
      );

      setSelectedItemsMap(
        items
          .filter((item) => item.show)
          .reduce((map, item) => {
            map.set(item.field, item);
            return map;
          }, new Map()),
      );

      itemsRef.current = new Array(items.length);
      renderRef.current = true;
    }
  }, [renderRef]);

  // use instance number to ensure IDs stay unique for multiple dropdowns on a page
  useEffect(() => {
    instances += 1;
    setInstanceNum(instances);

    return () => {
      instances -= 1;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      focusFirst();
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div className="dropDownHeader">
      <button
        aria-label={isOpen ? buttonAriaLabelOpen : buttonAriaLabelClosed}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((isOpen) => !isOpen);
        }}
        ref={buttonRef}
        className="dropDownButton"
      >
        <div className="dropDownButtonContent">{children}</div>
        <ArrowIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        // tabIndex is required for the onBlur handler to function, but
        // adding tabIndex triggers this linter rule requiring a role
        // to be added to the element. there are no roles which match the
        // function of this, since it is a non-interactive element, hence
        // the disabling of the rule here.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          onBlur={(e) => handleBlur(e)}
          tabIndex="-1"
          className="dropDownContent multiSelectDropDown"
          style={{
            right: align === 'right' ? 0 : 'auto',
            left: align === 'right' ? 'auto' : 0,
            cursor: 'default',
          }}
        >
          <div className="multiSelectDropDownWrapper">
            <fieldset className="multiSelectDropDownFieldSet">
              <legend style={{ position: 'absolute', clip: 'rect(0 0 0 0)' }}>
                {itemSelectionLegend}
              </legend>
              <div className="multiSelectDropDownControls">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    selectAll();
                  }}
                  className="multiSelectDropDownControlsButton"
                  aria-label={selectAllAriaLabel}
                >
                  <CheckIcon />
                  Select All
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    resetToDefaults();
                  }}
                  className="multiSelectDropDownControlsButton"
                  aria-label={resetToDefaultAriaLabel}
                >
                  <ResetIcon />
                  Reset to Defaults
                </button>
              </div>
              {items && (
                <ul className="multiSelectDropDownList">
                  {items.map((item, index) => (
                    <li key={`multiselect-dropdown-${instanceNum}-item-${index}`}>
                      <div className="dropDownContentElement multiSelectDropDownElement">
                        <label
                          htmlFor={`multiselect-dropdown-${instanceNum}-item-${index}`}
                          className="multiSelectDropDownElementLabel"
                        >
                          <input
                            ref={(el) => (itemsRef.current[index] = el)}
                            checked={!!selectedItemsMap.get(item.field)}
                            onChange={() => toggle(item)}
                            name={`multiselect-dropdown-${instanceNum}-item-${index}`}
                            type="checkbox"
                            id={`multiselect-dropdown-${instanceNum}-item-${index}`}
                            onKeyDown={(e) => handleKeyPress(e, index)}
                            className="multiSelectDropDownElementInput"
                          />
                          {itemToString(item)}
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
};
