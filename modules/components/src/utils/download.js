import { attempt, uniqueId } from 'lodash';
import Cookies from 'js-cookie';
import { getAlwaysAddHeaders } from './api';

let httpHeaders = {};

function getIFrameBody(iframe) {
  const document = iframe.contentWindow || iframe.contentDocument;
  return (document.document || document).body;
}

function getIframeResponse(iFrame) {
  return JSON.parse(getIFrameBody(iFrame).querySelector('pre').innerText);
}

function hashString(s) {
  return s.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0);
}

function toHtml(key, value) {
  return `<input
    type="hidden"
    name="${key}"
    value="${
      typeof value === 'object'
        ? JSON.stringify(value).replace(/"/g, '&quot;')
        : value
    }"
  />`;
}

function progressChecker(iFrame, cookieKey, downloadToken) {
  const checkCookie = () => downloadToken === Cookies.get(cookieKey);
  const interval = 1000;
  let intervalId = null;

  function cleanUp() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // TODO: iframe was being removed before download was initialize. figure out better way to check
    // iFrame.parentNode.removeChild(iFrame);
  }

  return Object.assign(
    new Promise((resolve, reject) => {
      function checkStatus() {
        const cookieExists = checkCookie();

        if (iFrame.__frame__loaded) {
          // The downloadToken cookie is removed before the server sends the response
          if (cookieExists) {
            Cookies.remove(cookieKey);
            cleanUp();
            throw attempt(getIframeResponse(iFrame));
          } else {
            // A download should be now initiated.
            cleanUp();
            resolve();
          }
        } else if (!cookieExists) {
          // In case the download is initiated without triggering the iFrame to reload
          cleanUp();
          resolve();
        }
      }

      intervalId = setInterval(checkStatus, interval);
    }),
    { cancel: cleanUp },
  );
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

function download({ url, params, method = 'GET' }) {
  // a cookie value that the server will remove as a download-ready indicator
  const downloadToken = uniqueId(`${+new Date()}-`);
  const cookieKey = navigator.cookieEnabled
    ? Math.abs(hashString(JSON.stringify(params) + downloadToken)).toString(16)
    : null;

  let fields = toHtml('params', {
    arrangerHttpHeaders: httpHeaders,
    ...params,
  });

  if (cookieKey) {
    Cookies.set(cookieKey, downloadToken);
    fields += `${toHtml('downloadCookieKey', cookieKey)}${toHtml(
      'downloadCookiePath',
      '/',
    )}`;
  }

  const iFrame = createIFrame({ method, url, fields });

  return cookieKey
    ? progressChecker(iFrame, cookieKey, downloadToken)
    : Promise.reject('no cookies');
}

export const addDownloadHttpHeaders = headers => {
  httpHeaders = { ...httpHeaders, ...headers };
};

export default download;
