'use strict';

const validCountryCodes = ['au', 'ca', 'nz', 'uk'];
const validCountryCodesLength = validCountryCodes.length; // cache this

// dontProcess turns off all processing (ultimately, localization)
const dontProcess = [
  /^\/blog\/?/, // don't localize the blog
  /\.[A-z0-9]{2,4}\/?$/, // don't process files; eg.: xml, html, txt, mp4, etc
  /\.htaccess\/?$/,
];
const dontProcessLength = dontProcess.length;

function isValidCountryCode (code) {
  if (!code || typeof code !== 'string') return false;
  code = code.toLowerCase();
  return (validCountryCodes.indexOf(code) > -1);
}

function getPathCountryCode (uri) {
  if (!uri || typeof uri !== 'string' || uri.length < 3) return;
  uri = uri.toLowerCase();

  for (let i = 0; i < validCountryCodesLength; i++) {
    const code = validCountryCodes[i];
    if (
      code &&
      uri.indexOf(`/${code}`) === 0 && // eg. startsWith
      (uri.length === 3 || // if only 3 characters, then it matches 100%
        (uri.length > 3 && uri.indexOf('/', 1) === 3) // if 4+ length, it must have a trailing slash, eg. /nz/, not /nzd-something
      )
    ) {
      return code; // return found country
    }
  }
}

function getHeaderCountryCode (request) {
  let code = request.headers['cloudfront-viewer-country'][0].value;
  if (isValidCountryCode(code)) return code.toLowerCase();
}

function getCookieCountryCode (request) {
  const cookieName = 'sharesight_country';
  const headers = request.headers;

  if (headers && headers.cookie) {
    // NOTE: A cookie may have multiple values on it, so we join and split again
    const cookies = headers.cookie.map(cookie => cookie.value).join(';');
    const regex = new RegExp(`^${cookieName}=(.*?)$`);

    // Look at all cookies, regex them, and pass matching strings on, then filter out undefineds, and grab the first result
    const code = cookies.split(';')
      .map(cookie => {
        const match = regex.exec(cookie.trim());
        if (Array.isArray(match) && typeof match[1] === 'string') return match[1];
      })
      .filter(value => isValidCountryCode(value))[0]; // NOTE the [0], just grabbing the first code after we filter out the bads

    if (code) return code.toLowerCase();
  }
}

function pathWithoutCountryCode (path) {
   // If the path starts with a country code, strip it by only taking everything from [3] onward.
   // eg: /nz/foo becomes /foo and /nz is discarded
  if (getPathCountryCode(path)) return path.slice(3);
  return path;
}

const handler = function (event, context, callback) {
    const request = event.Records[0].cf.request;
    const response = event.Records[0].cf.response;

    // if we don't want to localize the url, eg. Blogs
    for (let i=0; i < dontProcessLength; i++) {
      if (request.uri.match(dontProcess[i])) {
        console.log(`Matched a dontProcess (${dontProcess[i]}), returning.`);
        callback(null, response);
        return;
      }
    }

    const cookieCountryCode = getCookieCountryCode(request);
    const headerCountryCode = getHeaderCountryCode(request);
    let newUri = request.uri;

    newUri = pathWithoutCountryCode(newUri);

    if (cookieCountryCode) {
      newUri = `/${cookieCountryCode}/${newUri}`;
      console.log(`Localized using a cookie; new uri: ${newUri}`);
    } else if (headerCountryCode) {
      newUri = `/${headerCountryCode}/${newUri}`;
      console.log(`Localized using the cloudfront header; new uri: ${newUri}`);
    }

    newUri = newUri.replace(/\/+/g, '/'); // replace duplicate forward slashes in path

    if (newUri === request.uri) {
      console.log('URIs match, stopping.');
      callback(null, response);
      return;
    }

    if (response.status < 200 || response.status >= 300) {
      console.log(`Response status from origin was outside of 2xx; it's unlikely that localization would be valid.`);
      callback(null, response);
      return;
    }

    if (request.querystring) newUri += `?${request.querystring}`;

    response.status = 302;
    response.statusDescription = 'Found';
    response.body = ''; // drop the body on redirects
    response.headers['location'] = [{ key: 'Location', value: newUri }];

    // return a 302 to redirect them to the new page
    callback(null, response);
};

module.exports = {
  validCountryCodes: validCountryCodes,
  validCountryCodesLength: validCountryCodesLength,
  dontProcess: dontProcess,
  dontProcessLength: dontProcessLength,
  isValidCountryCode: isValidCountryCode,
  getPathCountryCode: getPathCountryCode,
  getHeaderCountryCode: getHeaderCountryCode,
  getCookieCountryCode: getCookieCountryCode,
  pathWithoutCountryCode: pathWithoutCountryCode,
  handler: handler,
};
