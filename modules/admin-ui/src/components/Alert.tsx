import styled from 'react-emotion';
import { ComponentType } from 'react';

enum AlertVariant {
  error = 'error',
  success = 'success',
}

const Alert: ComponentType<{ variant: string }> = styled(`div`)`
  width: 100%;
  padding: 10px;
  background: ${({
    variant = AlertVariant.success,
  }: {
    variant: AlertVariant;
  }) => {
    switch (variant) {
      case AlertVariant.error:
        return 'rgba(222, 27, 27, 0.1)';
      case AlertVariant.success:
        return 'rgba(30, 94, 55, 0.1)';
    }
  }};
  border-left: 3px solid
    ${({ variant = AlertVariant.success }: { variant: AlertVariant }) => {
      switch (variant) {
        case AlertVariant.error:
          return 'rgba(222, 27, 27, 0.6)';
        case AlertVariant.success:
          return 'rgba(30, 94, 55, 0.6)';
      }
    }};
`;

export default Alert;
