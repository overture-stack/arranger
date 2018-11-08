export type THoc<TInner, TOuter> = (
  InputCompoent: React.ComponentType<TInner & TOuter>,
) => React.ComponentType<TInner>;

export const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = function(evt: any) {
      resolve(evt.target.result);
    };
    reader.onerror = function(evt) {
      reject();
    };
  });
