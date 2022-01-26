import React, { createContext, useContext, useState } from 'react';

export const ArrangerContext = createContext({
  sqon: null,
});

export const ArrangerProvider = ({ children }) => {
  const [sqon, setSqon] = useState(null);

  const contextValues = {
    sqon,
  };

  return <ArrangerContext.Provider value={contextValues}>{children}</ArrangerContext.Provider>;
};

const useArrangerContext = () => useContext(ArrangerContext);

export default useArrangerContext;
