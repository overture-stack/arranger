import React from 'react';
import { compose, withState, withHandlers } from 'recompose';
import { css } from 'emotion';

import Input from '../Input';

const enhance = compose(
  withState('text', 'setText', ''),
  withHandlers({
    onTextChange: ({ setText }) => ({ target: { value } }) => setText(value),
    onFileUpload: ({ setText }) => async ({ target }) => {
      let files = [];
      for (let i = 0; i < target.files.length; i++)
        files = [...files, target.files[i]];
      const contents = await Promise.all(
        files.map(
          f =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = e => reject(e);
              reader.readAsText(f);
            }),
        ),
      );
      setText((contents || []).reduce((str, c) => `${str}${c}\n`, ``));
    },
  }),
);

const inputRef = React.createRef();
const MatchBox = ({
  instructionText = `Type or copy-and-paste a list of comma delimited identifiers, or choose a file of identifiers to upload`,
  placeholderText = `e.g. Id\ne.g. Id`,
  ButtonComponent = 'button',
  children,
  text,
  onTextChange,
  onFileUpload,
}) => (
  <div className="match-box">
    <div className="match-box-id-form">
      <div>{instructionText}</div>
      <Input
        Component="textarea"
        placeholder={placeholderText}
        value={text}
        onChange={onTextChange}
      />
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
        `}
      >
        <input
          type="file"
          className={css`
            position: absolute;
            top: -10000px;
            left: 0px;
          `}
          ref={inputRef}
          multiple
          onChange={onFileUpload}
        />
        <ButtonComponent type="submit" onClick={() => inputRef.current.click()}>
          Browse
        </ButtonComponent>
      </div>
    </div>
    {children({ ids: [] })}
  </div>
);

export default enhance(MatchBox);
