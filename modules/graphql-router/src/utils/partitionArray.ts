const partitionArray = <A, B>(
	array: (A | B)[],
	predicate: (input: A | B) => input is A,
): [A[], B[]] =>
	array.reduce<[A[], B[]]>(
		([matched, unmatched], item) => {
			if (predicate(item)) {
				return [[...matched, item], unmatched];
			} else {
				return [matched, [...unmatched, item]];
			}
		},
		[[], []],
	);

export default partitionArray;
