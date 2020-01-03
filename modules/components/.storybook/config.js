import 'babel-polyfill';
import { configure } from '@storybook/react';
import { setOptions } from '@storybook/addon-options';

let start = () => {
  if (process.env.STORYBOOK_PORTAL) {
    setOptions({ goFullScreen: true });
    configure(() => require('../stories/Portal'), module);
    return;
  }

  configure(() => require('../stories/index'), module);
};

start();
