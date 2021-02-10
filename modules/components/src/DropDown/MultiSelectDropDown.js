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
        <div
          onBlur={(e) => handleBlur(e)}
          role="listbox"
          tabIndex="-1"
          className="dropDownContent"
          style={{
            right: align === 'right' ? 0 : 'auto',
            left: align === 'right' ? 'auto' : 0,
            cursor: 'default',
          }}
        >
          <fieldset style={{ border: 0 }}>
            <legend style={{ position: 'absolute', clip: 'rect(0 0 0 0)' }}>
              {itemSelectionLegend}
            </legend>
            <div style={{ display: 'flex' }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  selectAll();
                }}
                aria-label={selectAllAriaLabel}
              >
                Select All
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  resetToDefaults();
                }}
                aria-label={resetToDefaultAriaLabel}
              >
                Reset to Defaults
              </button>
            </div>
            {items && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {items.map((item, index) => (
                  <li key={`multiselect-dropdown-${instanceNum}-item-${index}`}>
                    <div className="dropDownContentElement">
                      <label
                        htmlFor={`multiselect-dropdown-${instanceNum}-item-${index}`}
                        style={{
                          listStyle: 'none',
                          width: '100%',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          ref={(el) => (itemsRef.current[index] = el)}
                          checked={!!selectedItemsMap.get(item.field)}
                          onChange={() => toggle(item)}
                          name={`multiselect-dropdown-${instanceNum}-item-${index}`}
                          type="checkbox"
                          id={`multiselect-dropdown-${instanceNum}-item-${index}`}
                          onKeyDown={(e) => handleKeyPress(e, index)}
                          style={{ cursor: 'pointer' }}
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
      )}
    </div>
  );
};
