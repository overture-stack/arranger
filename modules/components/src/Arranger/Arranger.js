import React from 'react';
import { get } from 'lodash';

import { DataProvider } from '@/DataContext';

import columnsToGraphql from '../utils/columnsToGraphql';
import defaultApiFetcher from '../utils/api';

// TODO: This is a dummy object, exported for the DataContext's types, to ensure that a TS
// error comes up when this component is deprecated in a later version, after the rewrite
export let legacyProps;

class Arranger extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTableRows: [],
      sqon: null,
    };
  }

  fetchData = (options) => {
    const { apiFetcher = defaultApiFetcher } = this.props;

    return apiFetcher({
      endpoint: `/graphql`,
      body: columnsToGraphql(options),
    }).then((response) => {
      const hits = get(response, `data.${options.config.type}.hits`) || {};
      const data = get(hits, 'edges', []).map((e) => e.node);
      const total = hits.total || 0;
      return { total, data };
    });
  };

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
      graphqlField,
      children,
      render,
      component,
      apiFetcher = defaultApiFetcher,
    } = this.props;
    const { sqon, selectedTableRows } = this.state;
    const { setSelectedTableRows, setSQON } = this;

    const childProps = {
      apiFetcher,
      fetchData: this.fetchData,
      graphqlField,
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
        graphqlField={graphqlField}
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
