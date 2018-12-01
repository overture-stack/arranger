import * as React from 'react';
import IconMenu from 'mineral-ui-icons/IconMenu';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  WrappedComponent,
} from 'react-sortable-hoc';

const SortableItem = SortableElement(({ children, ...props }) => {
  const Children = children;
  return <Children {...props} />;
});

export default SortableContainer(
  ({
    items,
    children,
  }: {
    items: any;
    children: (props: { item: any }) => React.ReactElement<any> | null;
  }) => {
    interface ChildrenProps {
      item: any;
      index: number;
    }
    const Item: React.ComponentType<ChildrenProps> = ({ ...props }) => (
      <SortableItem {...props}>{children}</SortableItem>
    );
    return (
      <div>
        {items.map((item, index) => (
          <Item item={item} index={index} key={index} />
        ))}
      </div>
    );
  },
);

export const DragHandle = SortableHandle(() => (
  <IconMenu size="large" color="gray" />
));
