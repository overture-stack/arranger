import React from 'react';
import { get, pick } from 'lodash';

import columnsToGraphql from '@arranger/mapping-utils/dist/utils/columnsToGraphql';

import defaultApi from '../utils/api';

class Arranger extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedTableRows: [],
      sqon: null,
    };
  }

  fetchData = projectId => {
    return options => {
      const { api = defaultApi } = this.props;
      return api({
        endpoint: `/${projectId}/graphql`,
        body: columnsToGraphql(options),
      }).then(r => {
        const hits = get(r, `data.${options.config.type}.hits`) || {};
        const data = get(hits, 'edges', []).map(e => e.node);
        const total = hits.total || 0;
        return { total, data };
      });
    };
  };

  componentWillMount() {
    const hasChildren =
      this.props.children && React.Children.count(this.props.children) !== 0;

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

  render() {
    const {
      index,
      graphqlField,
      projectId,
      children,
      render,
      component,
      api = defaultApi,
    } = this.props;
    const { sqon, selectedTableRows } = this.state;

    const childProps = {
      api,
      sqon,
      selectedTableRows,
      projectId,
      index,
      graphqlField,
      fetchData: this.fetchData,
      setSQON: sqon => this.setState({ sqon }),
      setSelectedTableRows: selectedTableRows =>
        this.setState({ selectedTableRows }),
    };

    if (component) {
      return React.createElement(component, childProps);
    } else if (render) {
      return render(childProps);
    } else if (children) {
      return typeof children === 'function' ? children(childProps) : children;
    } else {
      return null;
    }
  }
}

export default Arranger;
