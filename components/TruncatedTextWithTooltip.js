import React from 'react';
import PropTypes from 'prop-types';
import { truncate } from 'lodash';

import StyledTooltip from './StyledTooltip';
import { Span } from './Text';

/**
 * A tooltip that truncates a value if it's longer than the
 * provided length.
 */
const TruncatedTextWithTooltip = ({ value, length = 30 }) => {
  if (value.length <= length) {
    return value;
  } else {
    return (
      <React.Fragment>
        <StyledTooltip content={() => <Span color="black.100">{value}</Span>}>
          {truncate(value, { length })}
        </StyledTooltip>
      </React.Fragment>
    );
  }
};

TruncatedTextWithTooltip.propTypes = {
  value: PropTypes.string.isRequired,
  length: PropTypes.number,
};

export default TruncatedTextWithTooltip;
