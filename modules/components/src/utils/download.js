import _ from 'lodash';
import Cookies from 'js-cookie';

const getBody = iframe => {
  const document = iframe.contentWindow || iframe.contentDocument;
  return (document.document || document).body;
};

// const cookiePath = document.querySelector('base').getAttribute('href')
const cookiePath = '/';
const getIframeResponse = iFrame =>
  JSON.parse(getBody(iFrame).querySelector('pre').innerText);
const showErrorModal = error => {
  const warning = error.warning || error.message;
  // show error
};

const progressChecker = (
  iFrame,
  cookieKey,
  downloadToken,
  inProgress,
  done,
) => {
  inProgress();
  const waitTime = 1000;
  let attempts = 0;
  let timeoutPromise = null;

  const cookieStillThere = () => downloadToken === Cookies.get(cookieKey);
  const handleError = () => {
    const error = _.flow(
      _.attempt,
      e =>
        _.isError(e)
          ? {
              message: 'GDC download service is currently experiencing issues.',
            }
          : e,
    )(_.partial(getIframeResponse, iFrame));

    return error;
  };

  const finished = () => {
    timeoutPromise = null;
    iFrame.parentNode.removeChild(iFrame);
    done();
  };

  const cancelDownload = () => {
    if (timeoutPromise) {
      clearTimeout(timeoutPromise);
      timeoutPromise = null;
    }
    finished();
  };

  const checker = () => {
    attempts++;
    if (iFrame.__frame__loaded) {
      // The downloadToken cookie is removed before the server sends the response
      if (cookieStillThere()) {
        const error = handleError();
        Cookies.remove(cookieKey);
        finished();
        showErrorModal(error);
      } else {
        // A download should be now initiated.
        finished();
      }
    } else if (cookieStillThere()) {
      // show notification

      timeoutPromise = setTimeout(checker, waitTime);
    } else {
      // In case the download is initiated without triggering the iFrame to reload
      finished();
    }
  };

  timeoutPromise = setTimeout(checker, waitTime);
};

const cookielessChecker = (iFrame, inProgress, done) => {
  // let attempts = 30;
  // const finished = () => {
  //   iFrame.parentNode.removeChild(iFrame);
  //   done();
  // };
  // const checker = () => {
  //   // Here we simply try to read the error message if the iFrame DOM is
  //   // reloaded; for a successful download, the error message is not in the DOM
  //   // therefore #getIframeResponse will return a JS error.
  //   const error = _.attempt(_.partial(getIframeResponse, iFrame));
  //   if (_.isError(error)) {
  //     // Keep waiting until we exhaust `attempts` then we do the cleanup.
  //     if (--attempts < 0) {
  //       finished();
  //     } else {
  //       // setTimeout(checker, waitTime)
  //     }
  //   } else {
  //     finished();
  //     showErrorModal(error);
  //   }
  // };
  // setTimeout(checker, waitTime);
};

const hashString = s =>
  s.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0);

const toHtml = (key, value) =>
  `<input
    type="hidden"
    name="${key}"
    value="${
      typeof value === 'object'
        ? JSON.stringify(value).replace(/"/g, '&quot;')
        : value
    }"
  />`;

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
  getBody(iFrame).appendChild(form);
  form.submit();
}

const download = ({ url, params, method = 'GET' }) => {
  const downloadToken = _.uniqueId(`${+new Date()}-`);
  // a cookie value that the server will remove as a download-ready indicator
  const cookieKey = navigator.cookieEnabled
    ? Math.abs(hashString(JSON.stringify(params) + downloadToken)).toString(16)
    : null;
  let fields = toHtml('params', params);

  if (cookieKey) {
    Cookies.set(cookieKey, downloadToken);
    fields += `${toHtml('downloadCookieKey', cookieKey)}${toHtml(
      'downloadCookiePath',
      cookiePath,
    )}`;
  }

  const iFrame = createIFrame({ method, url, fields });

  return cookieKey
    ? _.partial(progressChecker, iFrame, cookieKey, downloadToken)
    : _.partial(cookielessChecker, iFrame);
};

/*----------------------------------------------------------------------------*/

export default download;
