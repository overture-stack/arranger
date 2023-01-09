// Vendor
import React, { Children, cloneElement } from 'react';
import PropTypes from 'prop-types';

// Custom
import Row from './Row';

/*----------------------------------------------------------------------------*/

const Column = ({ style, children, spacing, props }) => (
  <Row style={{ ...style, flexDirection: 'column' }} {...props}>
    {!spacing && children}
    {spacing &&
      Children.map(children, (child, i) =>
        cloneElement(child, {
          ...child.props,
          style: {
            ...(i ? { marginTop: spacing } : {}),
            ...(child.props.style ? child.props.style : {}),
          },
        }),
      )}
  </Row>
);

Column.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object,
  spacing: PropTypes.string,
};

/*----------------------------------------------------------------------------*/

export default Column;
