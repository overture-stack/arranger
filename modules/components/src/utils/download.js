import { v4 as uuid } from 'uuid';

let httpHeaders = {};

/**
 * A hidden input carrying one field, its value set as a property so it is never parsed as markup and needs no
 * escaping.
 *
 * @param {string} name the field's name.
 * @param {unknown} value the field's value, sent as JSON when it is an object.
 * @returns {HTMLInputElement}
 */
function hiddenInput(name, value) {
  const input = document.createElement('input');

  input.type = 'hidden';
  input.name = name;
  input.value = typeof value === 'object' ? JSON.stringify(value) : `${value}`;

  return input;
}

/**
 * Submits a form into a hidden frame, so its response becomes a download without leaving the page. The form
 * sits in the page and targets the frame by name, and the frame is given no src, so nothing loads into it
 * before the submission and no browser can cancel the submission for a load of its own.
 *
 * @param {object} args
 * @param {string} args.method the form's method.
 * @param {string} args.url where the form is submitted.
 * @param {[string, unknown][]} args.fields each field's name and value.
 * @returns {HTMLIFrameElement} the frame the response is loaded into.
 */
function createIFrame({ method, url, fields }) {
  const frameName = `arranger-download-${uuid()}`;
  const iFrame = document.createElement('iframe');

  iFrame.style.display = 'none';
  iFrame.name = frameName;
  // Appending to document body to allow navigation away from the current
  // page and downloads in the background
  document.body.appendChild(iFrame);

  const form = document.createElement('form');
  form.style.display = 'none';
  form.method = method.toUpperCase();
  form.action = url;
  form.target = frameName;
  fields.forEach(([name, value]) => form.appendChild(hiddenInput(name, value)));

  document.body.appendChild(form);
  form.submit();
  form.remove();

  return iFrame;
}

function download({ url, params, method = 'GET', body = {} }) {
  const downloadKey = uuid();

  const resolveOnDownload = () => Promise.resolve();

  createIFrame({
    method,
    url,
    fields: Object.entries({ params, httpHeaders, ...body, downloadKey }),
  });

  return resolveOnDownload;
}

export const addDownloadHttpHeaders = (headers) => {
  httpHeaders = { ...httpHeaders, ...headers };
};

export default download;
