import React from 'react';
import { storiesOf } from '@storybook/react';
import { compose, withState } from 'recompose';
import { orderBy, get } from 'lodash';
import uuid from 'uuid';
import io from 'socket.io-client';
import { action } from '@storybook/addon-actions';

import DataTable, {
  Table,
  columnsToGraphql,
  TableToolbar,
  getSingleValue,
} from '../src/DataTable';

const withSQON = withState('sqon', 'setSQON', null);

const tableConfig = {
  timestamp: '2018-01-12T16:42:07.495Z',
  type: 'models',
  keyField: 'name',
  defaultSorted: [{ id: 'age_at_diagnosis', desc: false }],
  columns: [
    {
      show: true,
      Header: 'Age At Diagnosis',
      type: 'number',
      sortable: true,
      canChangeShow: true,
      accessor: 'age_at_diagnosis',
    },
    {
      show: true,
      Header: 'Name',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'name',
    },
  ],
};

const dummyConfig = {
  timestamp: '2018-01-12T16:42:07.495Z',
  type: 'files',
  keyField: 'file_id',
  defaultSorted: [{ id: 'access', desc: false }],
  columns: [
    {
      show: true,
      Header: 'Access',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'access',
    },
    {
      show: true,
      Header: 'File Id',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_id',
    },
    {
      show: true,
      Header: 'File Name',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_name',
    },
    {
      show: true,
      Header: 'Data Type',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'data_type',
    },
    {
      show: true,
      Header: 'File Size',
      type: 'bits',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_size',
    },
    {
      show: true,
      Header: 'Cases Primary Site',
      type: 'list',
      sortable: false,
      canChangeShow: false,
      query:
        'cases { hits(first: 5) { total, edges { node { primary_site } } } }',
      listAccessor: 'cases.hits.edges',
      totalAccessor: 'cases.hits.total',
      id: 'cases.primary_site',
    },
  ],
};


const AVAILABLE_THEMES = [
    {
      id: "theme_1",
      title: "theme 1",
      stylePath: './themeStyles/theme1.css'
    },
    {
      id: "theme_2",
      title: "theme 2",
      stylePath: './themeStyles/theme2.css'
    }
]

class StyleProvider extends React.Component {

  state = {
    themeLoaded: false,
    loadedStyle: null,
  }

  componentDidMount() {
    this.applyStyle(this.props.availableThemes, this.props.selected)
  }

  componentWillReceiveProps(nextProps) {
    this.applyStyle(nextProps.availableThemes, nextProps.selected)
  }

  applyStyle(_availableThemes, _selectedThemeId){
    const selectedThemeId = _selectedThemeId
    const stylePath = _availableThemes
      .find(theme => theme.id === selectedThemeId)
      .stylePath
    fetch(stylePath)
      .then(data => data.text())
      .then(str => this.setState({
        themeLoaded: true,
        loadedStyle: str,
      }))
  }

  render() {
    return this.state.themeLoaded
      ? (
        <>
          <style dangerouslySetInnerHTML={{__html:this.state.loadedStyle}}/>
          { this.props.children }
        </>
      )
      : null
    }
}

class ThemeSwitcher extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      selectedThemeId: props.availableThemes[0].id
    }
    this.onStyleChange = this.onStyleChange.bind(this)
  }
  onStyleChange(e){
    this.setState({
      ...this.state,
      selectedThemeId: e.target.value
    })
  }
  render(){
    return (
      <>
        <select value={this.state.selectedThemeId} onChange={ this.onStyleChange } >
          {
            this.props.availableThemes.map(theme => (
              <option key={theme.id} value={theme.id}> {theme.title} </option>
            ))
          }
        </select>
        <StyleProvider selected={this.state.selectedThemeId} availableThemes={this.props.availableThemes}>
          { this.props.children }
        </StyleProvider>
      </>
    )
  }
}

const dummyData = Array(1000)
  .fill()
  .map(() => {
    const cases = Array(Math.floor(Math.random() * 10))
      .fill()
      .map(() => ({
        node: {
          primary_site: uuid(),
        },
      }));
    return {
      access: Math.random() > 0.5 ? 'controlled' : 'open',
      file_id: uuid(),
      file_name: uuid(),
      data_type: uuid(),
      file_size: Math.floor(Math.random() * 10000000),
      cases: {
        hits: {
          total: cases.length,
          edges: cases,
        },
      },
    };
  });

const withColumns = compose(
  withState('columns', 'onColumnsChange', dummyConfig.columns),
);

const TableToolbarStory = withColumns(TableToolbar);

function fetchDummyData({ config, sort, offset, first }) {
  return Promise.resolve({
    total: dummyData.length,
    data: orderBy(
      dummyData,
      sort.map(s => s.field),
      sort.map(s => s.order),
    ).slice(offset, offset + first),
  });
}

function streamDummyData({ sort, first, onData, onEnd }) {
  for (let i = 0; i < dummyData.length; i += first) {
    onData({
      total: dummyData.length,
      data: (sort
        ? orderBy(dummyData, sort.map(s => s.field), sort.map(s => s.order))
        : dummyData
      ).slice(i, i + first),
    });
  }
  onEnd();
}

const EnhancedDataTable = withSQON(({ sqon, setSQON }) => (
  <DataTable
    config={tableConfig}
    onSQONChange={action('sqon changed')}
    onSelectionChange={action('selection changed')}
    streamData={({ columns, sort, first, onData, onEnd }) => {
      let socket = io(`http://localhost:5050`);
      socket.on('server::chunk', ({ data, total }) =>
        onData({
          total,
          data: data[tableConfig.type].hits.edges.map(e => e.node),
        }),
      );

      socket.on('server::stream::end', onEnd);

      socket.emit('client::stream', {
        index: tableConfig.type,
        size: 100,
        ...columnsToGraphql({ columns, sort, first }),
      });
    }}
    fetchData={options => {
      const API = 'http://localhost:5050/table';

      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(columnsToGraphql({ ...options, sqon })),
      })
        .then(r => r.json())
        .then(r => {
          const hits = get(r, `data.${options.config.type}.hits`) || {};
          const data = get(hits, 'edges', []).map(e => e.node);
          const total = hits.total || 0;
          return { total, data };
        });
    }}
  />
));
storiesOf('Table', module)
  .add('Table', () => (
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES}>
      <Table
        config={dummyConfig}
        fetchData={fetchDummyData}
        onSelectionChange={action('selection changed')}
      />
    </ThemeSwitcher>
  ))
  .add('Toolbar', () => (
    <TableToolbarStory
      onSQONChange={console.log.bind(console)}
      streamData={streamDummyData}
    />
  ))
  .add('Data Table', () => (
    <DataTable
      config={dummyConfig}
      customTypes={{
        list: props => {
          const columnList =
            get(props.original, props.column.listAccessor) || [];
          const total = get(props.original, props.column.totalAccessor);
          const firstValue = getSingleValue(columnList[0]);
          return total > 1 ? <a href="">{total} total</a> : firstValue || '';
        },
      }}
      fetchData={fetchDummyData}
      streamData={streamDummyData}
    />
  ))
  .add('Live Data Table', () => <EnhancedDataTable />);
