import DS from 'ember-data';
import ENV from 'screwdriver-ui/config/environment';
import Ember from 'ember';

export default DS.RESTAdapter.extend({
  session: Ember.inject.service('session'),
  namespace: ENV.APP.SDAPI_NAMESPACE,
  host: ENV.APP.SDAPI_HOSTNAME,

  /**
   * Add cors support to all ajax calls
   * @method ajax
   * @param  {String} url    the url for the calls
   * @param  {String} method the type of call eg. GET POST
   * @param  {Object} hash   configuration object for the call
   * @return {Promise}
   */
  ajax(url, method, hash) {
    const finalHash = hash || {};

    finalHash.crossDomain = true;
    finalHash.xhrFields = {
      withCredentials: true
    };

    return this._super(url, method, finalHash);
  },

  /**
   * Compute the headers to add the auth token in
   * @property {Object}
   */
  headers: Ember.computed(function cHeaders() {
    return { Authorization: `Bearer ${this.get('session').get('data.authenticated.token')}` };
  }).volatile(),

  /**
   * Interface for adding content to a payload before handleResponse is complete
   * Ideally, this could be handled by a model specific adapter or serializer, but Ember doesn't use
   * the correct [foo] adapter when making calls to /pipeline/:id/foo
   */
  decoratePayload(key, payload) {
    if (Array.isArray(payload[key])) {
      payload[key].map(o => this.insertLink(key, o));
    } else {
      this.insertLink(key, payload[key]);
    }
  },
  insertLink(key, o) {
    if (!o) {
      return;
    }

    if (key === 'pipeline' || key === 'pipelines') {
      o.links = {
        events: 'events',
        jobs: 'jobs',
        secrets: 'secrets'
      };
    } else if (key === 'job' || key === 'jobs') {
      o.links = {
        builds: 'builds'
      };
    }
  },

  /**
   * Overriding default adapter because our API doesn't provide model names around request data
   * https://github.com/emberjs/data/blob/v2.7.0/addon/adapters/rest.js#L883
   * @method handleResponse
   * @param  {Number}       status      response status
   * @param  {Object}       headers     response headers
   * @param  {Object}       payload     response payload
   * @param  {Object}       requestData original request info
   * @return {Object | DS.AdapterError} response
   */
  handleResponse(status, headers, payload, requestData) {
    // handle generically when there is an error key in the payload
    if (payload && payload.error) {
      return this._super(status, headers, { errors: payload }, requestData);
    }

    let data = {};
    let key;

    // urls are of the form: https://server.com/namespace/key1s/:id/key2s, but :id and key2s are optional
    const urlParser = new RegExp(
      `${ENV.APP.SDAPI_HOSTNAME}/${ENV.APP.SDAPI_NAMESPACE}/([^/]+)(/([^/]+))?(/([^/]+))?`
    );
    const matches = requestData.url.match(urlParser);

    // catch if we got a really weird url
    if (!matches) {
      // bail
      return this._super(...arguments);
    }

    // the last key on the path and remove the s at the end
    key = matches[5] || matches[1];
    key = key.substr(0, key.length - 1);

    // Fix our API not returning the model name in payload
    if (payload && Array.isArray(payload)) {
      key = `${key}s`;
      data[key] = payload;
    } else if (payload) {
      data[key] = payload;
    }
    this.decoratePayload(key, data);

    // Pass-through to super-class
    return this._super(status, headers, data, requestData);
  }
});
