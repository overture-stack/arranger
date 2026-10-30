import download from './download.js';

/** A document recording the elements the helper creates, where it puts them, and every submit. */
const recordingDocument = () => {
	const submits = [];
	const make = (tagName) => {
		const element = {
			children: [],
			parent: null,
			style: {},
			tagName,
			appendChild(child) {
				child.parent = element;
				element.children.push(child);
				return child;
			},
			remove() {
				if (element.parent) {
					element.parent.children = element.parent.children.filter((child) => child !== element);
					element.parent = null;
				}
			},
			submit() {
				submits.push({ form: element, inPage: element.parent === body, target: element.target });
			},
		};
		return element;
	};
	const body = make('BODY');

	return { body, createElement: (tagName) => make(tagName.toUpperCase()), submits };
};

describe('download', () => {
	const params = { files: [{ fileName: 'a "quoted" name.tsv', sqon: { content: [], op: 'and' } }] };
	let page;

	beforeEach(() => {
		page = recordingDocument();
		global.document = page;
	});

	afterEach(() => {
		delete global.document;
	});

	test('submits once, from a form in the page aimed at a hidden frame by name, which loads nothing first', () => {
		// When a download is asked for
		download({ method: 'POST', params, url: '/catalogue/download' });

		// Then one hidden frame with a name is in the page, and it was never sent to a src
		const frames = page.body.children.filter((element) => element.tagName === 'IFRAME');
		expect(frames).toHaveLength(1);
		expect(frames[0].name).toEqual(expect.any(String));
		expect(frames[0].name).not.toBe('');
		expect(frames[0].src).toBeUndefined();
		expect(frames[0].style.display).toBe('none');

		// And one POST was submitted once, while in the page, into that frame, its form removed afterwards
		expect(page.submits).toHaveLength(1);
		const [{ form, inPage, target }] = page.submits;
		expect(inPage).toBe(true);
		expect(target).toBe(frames[0].name);
		expect(form.method).toBe('POST');
		expect(form.action).toBe('/catalogue/download');
		expect(page.body.children).not.toContain(form);
	});

	test('carries each field as a hidden input whose value is exactly what was given', () => {
		download({ method: 'POST', params, url: '/catalogue/download' });

		const [{ form }] = page.submits;
		const valueOf = (name) => form.children.find((input) => input.name === name)?.value;

		expect(form.children.every((input) => input.tagName === 'INPUT' && input.type === 'hidden')).toBe(true);
		expect(JSON.parse(valueOf('params'))).toEqual(params);
		expect(valueOf('downloadKey')).toEqual(expect.any(String));
	});
});
