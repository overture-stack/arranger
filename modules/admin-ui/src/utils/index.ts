export type THoc<TInner, TOuter> = (
  InputCompoent: React.ComponentType<TInner & TOuter>,
) => React.ComponentType<TInner>;
