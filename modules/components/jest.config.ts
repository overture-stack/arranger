import { type JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	testEnvironment: 'node',
	verbose: true,
	modulePathIgnorePatterns: [
		'src',
	],
};

export default jestConfig;
