import React from 'react';

import { DataProvider } from '@/DataContext';

import defaultApiFetcher from '../utils/api';

// TODO: This is a dummy object, exported for the DataContext's types, to ensure that a TS
// error comes up when this component is deprecated in a later version, after the rewrite
export let legacyProps;

/** Arranger Root Component
 * @deprecated
 * This component used to serve as a makeshift context provider in older versions of Arranger.
 *
 * Please review the migration instructions to update your app as soon as possible.
 */

class Arranger extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTableRows: [],
      sqon: null,
    };
  }

  UNSAFE_componentWillMount() {
    const hasChildren = this.props.children && React.Children.count(this.props.children) !== 0;

    if (this.props.component && this.props.render) {
      console.warn(
        'You should not use <Arranger component> and <Arranger render> in the same arranger; <Arranger render> will be ignored',
      );
    }

    if (this.props.component && hasChildren) {
      console.warn(
        'You should not use <Arranger component> and <Arranger children> in the same arranger; <Arranger children> will be ignored',
      );
    }

    if (this.props.render && hasChildren) {
      console.warn(
        'You should not use <Arranger render> and <Arranger children> in the same arranger; <Arranger children> will be ignored',
      );
    }
  }

  setSelectedTableRows = (selectedTableRows) => this.setState({ selectedTableRows });
  setSQON = (sqon) => this.setState({ sqon });

  render() {
    const {
      index,
      documentType,
      children,
      render,
      component,
      apiFetcher = defaultApiFetcher,
    } = this.props;
    const { sqon, selectedTableRows } = this.state;
    const { setSelectedTableRows, setSQON } = this;

    const childProps = {
      apiFetcher,
      documentType,
      index,
      selectedTableRows,
      setSelectedTableRows,
      setSQON,
      sqon,
    };

    legacyProps = { index, selectedTableRows, setSelectedTableRows, setSQON, sqon };

    return (
      <DataProvider
        customFetcher={apiFetcher}
        documentType={documentType}
        legacyProps={legacyProps}
      >
        {component
          ? React.createElement(component, childProps)
          : render
          ? render(childProps)
          : children
          ? typeof children === 'function'
            ? children(childProps)
            : children
          : null}
      </DataProvider>
    );
  }
}

export default Arranger;
