import { useEffect, useRef, useState } from 'react';

import { ArrowIcon, CheckIcon, ResetIcon } from '@/Icons';
import { useThemeContext } from '@/ThemeProvider';

import './DropDown.css';

let instances = 0;

const MultiSelectDropDown = ({
  arrowColor: customArrowColor,
  arrowTransition: customArrowTransition,
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
  const panelRef = useRef();
  const itemsRef = useRef([]);
  const {
    components: {
      DropDown: {
        arrowColor: themeArrowColor,
        arrowTransition: themeArrowTransition,
        ...themeArrowProps
      } = {},
    } = {},
  } = useThemeContext();

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
    const nextTarget = e.relatedTarget;

    if (isOpen && panelRef.current && !panelRef.current.contains(nextTarget)) {
      setIsOpen(false);
    }
  };

  const handleClickOutside = (e) => {
    if (
      isOpen &&
      panelRef.current &&
      !panelRef.current.contains(e.target) &&
      e.target !== buttonRef.current
    ) {
      setIsOpen(false);
    }
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
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleEsc);
      focusFirst();
    }

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div className="dropDownHeader">
      <button
        aria-label={isOpen ? buttonAriaLabelOpen : buttonAriaLabelClosed}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onBlur={handleBlur}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((isOpen) => !isOpen);
        }}
        ref={buttonRef}
        className="dropDownButton"
      >
        <div className="dropDownButtonContent">{children}</div>
        <ArrowIcon
          fill={customArrowColor || themeArrowColor}
          pointUp={isOpen}
          transition={customArrowTransition || themeArrowTransition}
          {...themeArrowProps}
        />
      </button>

      {isOpen && (
        <div
          className="dropDownContent multiSelectDropDown"
          style={{
            right: align === 'right' ? 0 : 'auto',
            left: align === 'right' ? 'auto' : 0,
          }}
          ref={panelRef}
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
                            onBlur={index === items.length - 1 ? handleBlur : undefined}
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

export default MultiSelectDropDown;
