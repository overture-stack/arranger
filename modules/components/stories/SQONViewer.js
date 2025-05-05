import { storiesOf } from '@storybook/react';
import React from 'react';

import SQONViewer from '#SQONViewer/index.js';

import { themeDecorator } from './decorators.js';

storiesOf('SQONView', module)
	.addDecorator(themeDecorator)
	.add('Empty SQON', () => <SQONViewer sqon={{}} />)
	.add('one field, one value', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: ['lung'],
						},
					},
				],
			}}
		/>
	))
	.add('one field, two values', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: ['lung', 'heart'],
						},
					},
				],
			}}
		/>
	))
	.add('one field, 5 values', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: ['lung', 'heart', 'brain', 'blood', 'kidney'],
						},
					},
				],
			}}
		/>
	))
	.add('one field, 20 values', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: [
								'lung',
								'heart',
								'brain',
								'blood',
								'kidney',
								'lung1',
								'heart1',
								'brain1',
								'blood1',
								'kidney1',
								'lung2',
								'heart2',
								'brain2',
								'blood2',
								'kidney2',
								'lung3',
								'heart3',
								'brain3',
								'blood3',
								'kidney3',
							],
						},
					},
				],
			}}
		/>
	))
	.add('two fields, 3 values each', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: ['lung', 'heart', 'brain'],
						},
					},
					{
						op: 'in',
						content: {
							field: 'gender',
							value: ['female', 'male', 'unknown'],
						},
					},
				],
			}}
		/>
	))
	.add('range', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: '>=',
						content: {
							field: 'cases.exposures.cigarettes_per_day',
							value: ['1'],
						},
					},
					{
						op: '<=',
						content: {
							field: 'cases.exposures.cigarettes_per_day',
							value: ['5'],
						},
					},
				],
			}}
		/>
	))
	.add('range and term', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: '>=',
						content: {
							field: 'cases.exposures.cigarettes_per_day',
							value: ['1'],
						},
					},
					{
						op: '<=',
						content: {
							field: 'cases.exposures.cigarettes_per_day',
							value: ['5'],
						},
					},
					{
						op: 'in',
						content: {
							field: 'primary_site',
							value: ['heart', 'lung', 'bone', 'blood', 'liver'],
						},
					},
				],
			}}
		/>
	))
	.add('value is not array', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'is',
						content: {
							field: 'gender',
							value: 'female',
						},
					},
					{
						op: 'is',
						content: {
							field: 'cases.exposures.cigarettes_per_day',
							value: 5,
						},
					},
				],
			}}
		/>
	))
	.add('text filter', () => (
		<SQONViewer
			sqon={{
				op: 'and',
				content: [
					{
						op: 'filter',
						content: {
							fields: ['gender', 'state', 'country'],
							value: 'fema',
						},
					},
				],
			}}
		/>
	));
