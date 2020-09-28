/* eslint-disable */
/**
 * Copy of 'react-table/lib/hoc/selectTable' from v6.8.6 (current version in use)
 * Modified to add `aria-label` support to checkboxes, since support wasn't officially added until v6.9.0
 */
import React from 'react'

const defaultSelectInputComponent = props => {
  return (
    <input
      type={props.selectType || 'checkbox'}
      checked={props.checked}
      aria-label={`${props.checked ? 'Deselect' : 'Select'} ${props.id ? 'this row' : 'all rows'}` }
      onClick={e => {
        const { shiftKey } = e
        e.stopPropagation()
        props.onClick(props.id, shiftKey, props.row)
      }}
      onChange={() => {}}
    />
  )
}

export default Component => {
  const wrapper = class RTSelectTable extends React.Component {
    constructor(props) {
      super(props)
    }

    rowSelector(row) {
      if (!row || !row.hasOwnProperty(this.props.keyField)) return null
      const { toggleSelection, selectType, keyField } = this.props
      const checked = this.props.isSelected(row[this.props.keyField])
      const inputProps = {
        checked,
        onClick: toggleSelection,
        selectType,
        id: row[keyField],
        row,
      }
      return React.createElement(this.props.SelectInputComponent, inputProps)
    }

    headSelector(row) {
      const { selectType } = this.props
      if (selectType === 'radio') return null

      const { toggleAll, selectAll: checked, SelectAllInputComponent } = this.props
      const inputProps = {
        checked,
        onClick: toggleAll,
        selectType,
      }

      return React.createElement(SelectAllInputComponent, inputProps)
    }

    // this is so we can expose the underlying ReactTable to get at the sortedData for selectAll
    getWrappedInstance() {
      if (!this.wrappedInstance) console.warn('RTSelectTable - No wrapped instance')
      if (this.wrappedInstance.getWrappedInstance) return this.wrappedInstance.getWrappedInstance()
      else return this.wrappedInstance
    }

    render() {
      const {
        columns: originalCols,
        isSelected,
        toggleSelection,
        toggleAll,
        keyField,
        selectAll,
        selectType,
        selectWidth,
        SelectAllInputComponent,
        SelectInputComponent,
        ...rest
      } = this.props
      const select = {
        id: '_selector',
        accessor: () => 'x', // this value is not important
        Header: this.headSelector.bind(this),
        Cell: ci => {
          return this.rowSelector.bind(this)(ci.original)
        },
        width: selectWidth || 30,
        filterable: false,
        sortable: false,
        resizable: false,
        style: { textAlign: 'center' },
      }
      const columns = [select, ...originalCols]
      const extra = {
        columns,
      }
      return <Component {...rest} {...extra} ref={r => (this.wrappedInstance = r)} />
    }
  }

  wrapper.displayName = 'RTSelectTable'
  wrapper.defaultProps = {
    keyField: '_id',
    isSelected: key => {
      console.log('No isSelected handler provided:', { key })
    },
    selectAll: false,
    toggleSelection: (key, shift, row) => {
      console.log('No toggleSelection handler provided:', { key, shift, row })
    },
    toggleAll: () => {
      console.log('No toggleAll handler provided.')
    },
    selectType: 'check',
    SelectInputComponent: defaultSelectInputComponent,
    SelectAllInputComponent: defaultSelectInputComponent,
  }

  return wrapper
}
