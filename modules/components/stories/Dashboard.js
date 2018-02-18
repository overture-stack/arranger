import React from 'react';
import StoryRouter from 'storybook-router';
import { storiesOf } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/Admin/Dashboard';

storiesOf('Dashboard', module)
  .addDecorator(StoryRouter())
  .add('Dashboard', () => (
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  ));
