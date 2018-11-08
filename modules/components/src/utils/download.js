import uuid from 'uuid';

let httpHeaders = {};

function getIFrameBody(iframe) {
  const document = iframe.contentWindow || iframe.contentDocument;
  return (document.document || document).body;
}

function toHtml(key, value) {
  return `<input
    type="hidden"
    name="${key}"
    aria-label="${key}"
    value="${
      typeof value === 'object'
        ? JSON.stringify(value).replace(/"/g, '&quot;')
        : value
    }"
  />`;
}

function createIFrame({ method, url, fields }) {
  const iFrame = document.createElement('iframe');

  iFrame.style.display = 'none';
  iFrame.src = 'about:blank';
  iFrame.onload = function() {
    this.__frame__loaded = true;
  };
  // Appending to document body to allow navigation away from the current
  // page and downloads in the background
  document.body.appendChild(iFrame);
  iFrame.__frame__loaded = false;

  const form = document.createElement('form');
  form.method = method.toUpperCase();
  form.action = url;
  form.innerHTML = fields;
  getIFrameBody(iFrame).appendChild(form);
  form.submit();

  return iFrame;
}

function download({ url, params, method = 'GET', body = {} }) {
  const downloadKey = uuid();

  const resolveOnDownload = () => Promise.resolve();

  createIFrame({
    method,
    url,
    fields: Object.entries({ params, httpHeaders, ...body, downloadKey })
      .map(([key, value]) => toHtml(key, value))
      .join('\n'),
  });

  return resolveOnDownload;
}

export const addDownloadHttpHeaders = headers => {
  httpHeaders = { ...httpHeaders, ...headers };
};

export default download;
