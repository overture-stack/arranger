import React from 'react';
import { css } from 'emotion';
import Spinner from 'react-spinkit';

const defaultSpinner = (
  <Spinner
    fadeIn="none"
    name="circle"
    color="#a9adc0"
    style={{
      width: 30,
      height: 30,
    }}
  />
);

const LoadingScreen = ({ spinner = defaultSpinner }) => (
  <div
    className={`loadingScreen ${css`
      position: absolute;
      left: 0px;
      right: 0px;
      top: 0px;
      bottom: 0px;
      display: flex;
      justify-content: center;
      align-items: center;
    `}`}
  >
    {spinner}
  </div>
);

export default LoadingScreen;
