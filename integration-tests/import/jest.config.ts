import { type JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
	moduleNameMapper: {
		'\\.(css|less)$': '<rootDir>/__mocks__/styleMock.cjs',
		'^lodash$': 'lodash-es',
	},
	transform: {
		'^.+.[jt]sx?$': [
			'ts-jest',
			{
				diagnostics: {
					warnOnly: true,
				},
				useESM: true,
			},
		],
	},
	transformIgnorePatterns: ['/node_modules/(?!(react-spinkit)/)'],
};

export default jestConfig;
