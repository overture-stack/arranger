import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

const EmptyMessage = ({ className, message }: { className?: string; message: string }) => {
	const {
		components: {
			SQONViewer: {
				EmptyMessage: {
					arrowColor: themeArrowColor,
					className: themeClassName,
					fontColor: themeFontColor,
					fontSize: themeFontSize,
					fontWeight: themeFontWeight = 'normal',
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'EmptyMessage' });

	return (
		<div
			className={cx('sqon-empty-message', themeClassName, className)}
			css={css`
				color: ${themeFontColor};
				font-size: ${themeFontSize};
				font-weight: ${themeFontWeight};
			`}
		>
			<span
				className="sqon-empty-message-arrow"
				css={css`
					color: ${themeArrowColor};
					margin-right: 0.2em;
				`}
			>
				{'\u2190'}
			</span>

			{message}
		</div>
	);
};

export default EmptyMessage;
