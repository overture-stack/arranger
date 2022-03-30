import { Children, cloneElement } from 'react';
import { css } from '@emotion/react';
import PropTypes from 'prop-types';

/*----------------------------------------------------------------------------*/

const baseStyle = {
  display: 'flex',
  flexDirection: 'row',
  boxSizing: 'border-box',
  position: 'relative',
  outline: 'none',
};

// adding temporary defaults to make the props optional when imported in TSX files
const Row = ({
  as = 'div',
  children = [],
  Component = as,
  flex = undefined,
  spacing = '',
  style = {},
  wrap = false,
  ...props
}) => (
  <Component
    css={[
      baseStyle,
      css`
        flex: ${flex};
        flex-wrap: ${wrap && 'wrap'};
      `,
      style,
    ]}
    {...props}
  >
    {!spacing && children}
    {spacing &&
      Children.map(
        children,
        (child, i) =>
          child &&
          cloneElement(child, {
            ...child.props,
            key: i,
            style: {
              ...(i ? { marginLeft: spacing } : {}),
              ...(child.props.style ? child.props.style : {}),
            },
          }),
      )}
  </Component>
);

Row.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node,
  Component: PropTypes.elementType,
  style: PropTypes.object,
  flex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  wrap: PropTypes.bool,
  spacing: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/*----------------------------------------------------------------------------*/

export default Row;
