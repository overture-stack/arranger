import { type JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	testEnvironment: 'node',
	verbose: true,
	modulePathIgnorePatterns: [
		'src',
		// wireit's local cache stores a full copy of dist/ (including the accidentally-copied
		// .test.js files below), which would otherwise double-count every test suite.
		'.wireit',
	],
	// Several components import CSS directly, or transitively through a dependency (react-spinkit,
	// react-datepicker, react-input-range, react-tippy). Jest has no CSS parser and would otherwise
	// fail to even load a test file that imports one of these, before any test in it can run.
	moduleNameMapper: {
		'\\.css$': '<rootDir>/jest/styleMock.js',
	},
};

export default jestConfig;
