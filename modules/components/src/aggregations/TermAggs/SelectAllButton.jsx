import { css } from '@emotion/react';
import cx from 'classnames';

import { TransparentButton } from '#Button/index.js';

// check if all buckets are selected/active or not
export const checkBucketsAllSelected = (isActive, buckets, fieldName) =>
	buckets.every((bucket) => isActive({ fieldName, value: bucket.name }));

const SelectAllButton = ({ className = '', css: customCSS = '', areBucketsAllSelected, ...props }) => (
	<TransparentButton
		className={cx('selectAll-wrapper', className)}
		css={[
			css`
				margin-left: 0.5rem;
				text-decoration: underline;
			`,
			customCSS,
		]}
		{...props}
	>
		{areBucketsAllSelected ? 'Deselect' : 'Select'} All
	</TransparentButton>
);

export default SelectAllButton;
