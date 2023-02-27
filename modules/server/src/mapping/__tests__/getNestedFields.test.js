import getNestedFields from '../getNestedFields';

test('1.getNestedFields', () => {
	let actual = getNestedFields({
		diagnoses: {
			type: 'nested',
			properties: {
				age_at_diagnosis: {
					type: 'long',
				},
				project: {
					properties: {
						project_id: {
							type: 'keyword',
						},
					},
				},
				treatments: {
					type: 'nested',
					properties: {
						days_to_treatment: {
							type: 'long',
						},
					},
				},
			},
		},
	});

	let expected = ['diagnoses', 'diagnoses.treatments'];

	expect(actual.length).toBe(expected.length);
	expected.forEach((field, i) => expect(field).toEqual(actual[i]));
});

test('2.getNestedFields deep nested', () => {
	let actual = getNestedFields({
		family: {
			properties: {
				family_members: {
					type: 'nested',
					properties: {
						available_data_types: {
							type: 'keyword',
						},
						created_at: {
							type: 'date',
						},
					},
				},
			},
		},
	});
	let expected = ['family.family_members'];

	expect(actual.length).toBe(expected.length);
	expected.forEach((field, i) => expect(field).toEqual(actual[i]));
});
