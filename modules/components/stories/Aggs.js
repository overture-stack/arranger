import { Component } from '@reach/component-component';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { DatesAggs, BooleanAggs, TermAggs, RangeAggs, AggsPanel } from '#aggregations/index.js';
import { inCurrentSQON, currentFieldValue } from '#SQONViewer/utils.js';
import State from '#State.js';

import './Aggs.css';
import { themeDecorator } from './decorators.js';


const bolleanAggs = [
	{
		fieldName: 'participants__is_proband',
		displayName: 'Participants is proband',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				key: '0',
				doc_count: 2580,
				key_as_string: 'false',
			},
			{
				key: '1',
				doc_count: 961,
				key_as_string: 'true',
			},
		],
	},
	{
		fieldName: 'sequencing_experiments__is_paired_end',
		displayName: 'Is Paired Ende',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				key: '0',
				doc_count: 2580,
				key_as_string: 'false',
			},
			{
				key: '1',
				doc_count: 961,
				key_as_string: 'true',
			},
		],
	},
	{
		fieldName: 'sequencing_experiments__is_paired_end_0',
		displayName: 'Is Paired Ende',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				key: '0',
				doc_count: 0,
				key_as_string: 'false',
			},
			{
				key: '1',
				doc_count: 961,
				key_as_string: 'true',
			},
		],
	},
	{
		fieldName: 'sequencing_experiments__is_paired_end_1',
		displayName: 'Is Paired Ende',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				key: '0',
				doc_count: 2312,
				key_as_string: 'false',
			},
			{
				key: '1',
				doc_count: 0,
				key_as_string: 'true',
			},
		],
	},
];

let aggs = [
	{
		fieldName: 'color',
		displayName: 'Color',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				doc_count: 1,
				key: 'green',
			},
			{
				doc_count: 5,
				key: 'yellow',
			},
			{
				doc_count: 12,
				key: 'blue',
			},
		],
	},
	{
		fieldName: 'taste',
		displayName: 'Taste',
		isActive: false,
		type: 'Aggregations',
		allowedValues: [],
		restricted: false,
		buckets: [
			{
				doc_count: 1,
				key: 'spicy',
			},
			{
				doc_count: 5,
				key: 'sweet',
			},
			{
				doc_count: 12,
				key: 'sour',
			},
			{
				doc_count: 5,
				key: 'salty',
			},
			{
				doc_count: 12,
				key: 'umami',
			},
			{
				doc_count: 12,
				key: 'bland',
			},
		],
	},
];

storiesOf('Aggs', module)
	.addDecorator(themeDecorator)
	.add('TermAggs', () => (
		<div className="term-agg-wrapper">
			<TermAggs
				fieldName="disease_type"
				displayName="Disease Type"
				buckets={[
					{
						doc_count: 2,
						key: 'Acute Myeloid Leukemia',
					},
					{
						doc_count: 10,
						key: 'Acinar cell neoplasms',
					},
				]}
				handleValueClick={action('Term Agg Selection')}
			/>
		</div>
	))
	.add('TermAggs with headerTitle', () => (
		<div className="term-agg-wrapper">
			<TermAggs
				fieldName="disease_type"
				displayName="Disease Type"
				buckets={[
					{
						doc_count: 2,
						key: 'Acute Myeloid Leukemia',
					},
					{
						doc_count: 10,
						key: 'Acinar cell neoplasms',
					},
				]}
				headerTitle="# files"
			/>
		</div>
	))
	.add('TermAggssWithSQON', () => (
		<State
			initial={{ sqon: null }}
			render={({ sqon, update }) => (
				<div>
					<div>SQON: {JSON.stringify(sqon)}</div>
					<div
						css={`
							width: 300px;
						`}
					>
						{aggs.map((agg) => (
							// TODO: switch on agg type
							<TermAggs
								key={agg.field}
								{...agg}
								handleValueClick={({ generateNextSQON }) => update({ sqon: generateNextSQON(sqon) })}
								isActive={(d) =>
									inCurrentSQON({
										value: d.value,
										dotFieldName: d.fieldName,
										currentSQON: sqon,
									})
								}
							/>
						))}
					</div>
				</div>
			)}
		/>
	))
	.add('DatesAggs', () => (
		<div className="term-agg-wrapper">
			<DatesAggs
				fieldName="disease_type"
				displayName="Disease Type"
				stats={{
					// expects linux timestamp
					min: 1529539200125,
					max: 1529539259913,
				}}
				handleValueClick={action('Term Agg Selection')}
			/>
		</div>
	))
	.add('DatesAggsWithSQON', () => (
		<Component initialState={{ sqon: null }}>
			{({ state: { sqon }, setState }) => (
				<div>
					<div>SQON: {JSON.stringify(sqon)}</div>
					<div
						css={`
							width: 300px;
						`}
					>
						<DatesAggs
							fieldName="disease_type"
							displayName="Disease Type"
							stats={{
								min: 1529539200125,
								max: 1529539259913,
							}}
							handleDateChange={({ generateNextSQON = () => { } } = {}) => setState({ sqon: generateNextSQON(sqon) })}
							getActiveValue={({ op, fieldName }) =>
								currentFieldValue({
									op,
									dotFieldName: fieldName,
									sqon,
								})
							}
						/>
					</div>
				</div>
			)}
		</Component>
	))
	.add('RangeAggs', () => (
		<RangeAggs
			fieldName="cases__diagnoses__days_to_death"
			displayName="Diagnoses Days To Death"
			stats={{
				min: 15,
				max: 820,
				count: 1000,
				avg: 70,
				sum: 15000,
			}}
			handleChange={action(`Range Change`)}
		/>
	))
	.add('RangeAggsWithSQON', () => (
		<State
			initial={{ sqon: null }}
			render={({ sqon, update }) => (
				<div className="range with sqon">
					<div>SQON: {JSON.stringify(sqon)}</div>
					<RangeAggs
						fieldName="cases__diagnoses__days_to_death"
						displayName="Diagnoses Days To Death"
						unit={'d'}
						stats={{
							min: 15,
							max: 820,
							count: 1000,
							avg: 70,
							sum: 15000,
						}}
						handleChange={({ generateNextSQON }) => update({ sqon: generateNextSQON(sqon) })}
					/>
				</div>
			)}
		/>
	))
	.add('BooleanAggs', () => (
		<BooleanAggs
			fieldName="cases__diagnoses__days_to_death"
			displayName="Diagnoses Days To Death"
			buckets={[
				{
					key: '0',
					doc_count: 2580,
					key_as_string: 'false',
				},
				{
					key: '1',
					doc_count: 961,
					key_as_string: 'true',
				},
			]}
			handleChange={action(`Range Change`)}
		/>
	))
	.add('BooleanAggsWithSqon', () => (
		<State
			initial={{ sqon: null }}
			render={({ sqon, update }) => (
				<div>
					<div>SQON: {JSON.stringify(sqon)}</div>
					<div
						css={`
							width: 300px;
						`}
					>
						{bolleanAggs.map((agg) => (
							<BooleanAggs
								key={agg.field}
								{...agg}
								handleValueClick={({ generateNextSQON }) => update({ sqon: generateNextSQON(sqon) })}
								isActive={(d) =>
									inCurrentSQON({
										value: d.value,
										dotFieldName: d.fieldName,
										currentSQON: sqon,
									})
								}
							/>
						))}
					</div>
				</div>
			)}
		/>
	))
	.add('LiveDataAggsPanel', () => (
		<State
			initial={{ index: '', sqon: {} }}
			render={({ index, update }) => (
				<div>
					<label>index: </label>
					<input // <-- could be a dropdown of available indices
						value={index}
						onChange={(e) => update({ index: e.target.value })}
					/>
					{index && (
						<div
							css={`
								width: 300px;
							`}
						>
							<AggsPanel aggs={aggs} index={index} debounceTime={200} />
						</div>
					)}
				</div>
			)}
		/>
	));
