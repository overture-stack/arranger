import React from 'react';
import Component from 'react-component-component';

export default ({ children }) => {
  const initialState = {
    projects: [],
    indices: [],
    loading: true,
    selectedProject: undefined,
    selectedIndex: undefined,
  };
  const didMount = s =>
    fetch('http://localhost:5050/projects', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"eshost":"http://localhost:9200"}',
    })
      .then(res => res.json())
      .then(data => {
        return new Promise(resolve => {
          s.setState({ projects: data.projects }, resolve);
        });
      });
  // .then(getIndices(s));
  const getIndices = projectId =>
    fetch(`http://localhost:5050/projects/${projectId}/types`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"eshost":"http://localhost:9200"}',
    }).then(res => res.json());
  const onProjectSelect = s => e => {
    const value = e.target.value;
    s.setState({ selectedProject: value, selectedIndex: undefined }, () =>
      getIndices(value).then(data =>
        s.setState({
          indices: data.types,
        }),
      ),
    );
  };
  const onIndexSelect = s => e => {
    s.setState({ selectedIndex: e.target.value });
  };
  return (
    <Component initialState={initialState} didMount={didMount}>
      {s => (
        <div>
          <div>
            <select
              value={s.state.selectedProject}
              onChange={onProjectSelect(s)}
            >
              <option value={undefined} disabled selected>
                Select a project version
              </option>
              {s.state.projects.map(option => (
                <option key={option.id} value={option.id}>
                  {option.id}
                </option>
              ))}
            </select>
          </div>
          {s.state.selectedProject && (
            <div>
              <select value={s.state.selectedIndex} onChange={onIndexSelect(s)}>
                <option value={undefined} disabled selected>
                  Select an index
                </option>
                {s.state.indices.map(option => (
                  <option value={option.name} key={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ border: 'solid 1px lightgrey' }}>
            {s.state.selectedProject &&
              s.state.selectedIndex &&
              children({
                project: s.state.selectedProject,
                index: s.state.selectedIndex,
              })}
          </div>
        </div>
      )}
    </Component>
  );
};
