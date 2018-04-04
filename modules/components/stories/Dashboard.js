import React from 'react';
import StoryRouter from 'storybook-router';
import { storiesOf } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/Admin/Dashboard';
import { themeDecorator } from './decorators';

storiesOf('Dashboard', module)
  .addDecorator(themeDecorator)
  .addDecorator(StoryRouter())
  .add('Dashboard', () => (
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  ))
  .add('x', () => <div>x</div>);
