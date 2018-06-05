export default ({ files }) =>
  Promise.all(
    [...files].map(
      f =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ name: f.name, content: reader.result });
          reader.onerror = e => reject(e);
          reader.readAsText(f);
        }),
    ),
  );
