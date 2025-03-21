import { storiesOf } from '@storybook/react';
import React from 'react';

import { elasticMappingToDisplayTreeData } from '#AdvancedFacetView/utils.js';
import NestedTreeView from '#NestedTreeView/index.js';

import { themeDecorator } from './decorators';

const dataSource = [
	{
		title: 'Animal',
		id: 'animal',
		children: [
			{
				title: 'Cat',
				id: 'cat',
			},
			{
				title: 'Dog',
				id: 'dog',
				children: [
					{
						title: 'Beagle',
						id: 'beagle',
						children: [
							{
								title: 'My Beagle',
								id: 'beagle1',
							},
							{
								title: "Alex's Beagle",
								id: 'beagle2',
							},
						],
					},
					{
						title: 'Pug',
						id: 'pug',
						children: [
							{
								title: 'My Pug',
								id: 'pug1',
							},
							{
								title: "Alex's Pug",
								id: 'pug2',
							},
						],
					},
				],
			},
		],
	},
];

const MOCK_MAPPING = {
	boolean: {
		type: 'boolean',
	},
	children: {
		properties: {
			key: {
				type: 'text',
				fields: {
					keyword: {
						type: 'keyword',
						ignore_above: 256,
					},
				},
			},
		},
	},
	float: {
		type: 'float',
	},
	int: {
		type: 'long',
	},
	stringarray: {
		type: 'text',
		fields: {
			keyword: {
				type: 'keyword',
				ignore_above: 256,
			},
		},
	},
	text: {
		type: 'text',
		fields: {
			keyword: {
				type: 'keyword',
				ignore_above: 256,
			},
		},
	},
};

storiesOf('Treeview', module)
	.addDecorator(themeDecorator)
	.add('Treeview', () => (
		<>
			<NestedTreeView dataSource={elasticMappingToDisplayTreeData(MOCK_MAPPING)} />
			<NestedTreeView dataSource={dataSource} />
		</>
	));
