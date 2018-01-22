import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import Dashboard from '../src/Admin/Dashboard';

storiesOf('Dashboard', module).add('Dashboard', () => <Dashboard />);
