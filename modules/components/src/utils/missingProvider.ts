import { useEffect } from 'react';

const missingProviderHandler = (contextName?: string, callerName?: string) => {
  if (process.env.NODE_ENV === 'development' && contextName !== callerName) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      callerName && console.info(`The following error was generated by '${callerName}':`);
      callerName || console.info(`noCallerNAME!!!`);
      console.error(
        `Your app is trying to access data from ${
          contextName ?? 'an Arranger Context'
        }, but that Provider is missing.` +
          '\nAs a result, you may experience unexpected behaviour or errors.',
      );
    }, [callerName, contextName]);
  }
};

export default missingProviderHandler;
