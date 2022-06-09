import { PropsWithChildren } from 'react';

const MetaMorphicChild = ({ children: Component }: PropsWithChildren<any>) => {
  switch (true) {
    case typeof Component === 'function':
      return <Component />;

    case Array.isArray(Component):
      return Component.map((child: any, index: number) => (
        <MetaMorphicChild key={index}>{child}</MetaMorphicChild>
      ));

    default:
      return Component;
  }
};

export default MetaMorphicChild;
