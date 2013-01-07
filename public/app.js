/*globals accessToken:true*/

// The URL of the Singly API endpoint
var apiBaseUrl = 'https://api.singly.com';

// A small wrapper for getting data from the Singly API
var singly = {
  get: function(url, options, callback) {
    if (options === undefined ||
      options === null) {
      options = {};
    }

    options.access_token = accessToken;

    $.getJSON(apiBaseUrl + url, options, callback);
  }
};

// Runs after the page has loaded
$(function() {
  // If there was no access token defined then return
  if (accessToken === 'undefined' ||
    accessToken === undefined) {
    return;
  }

  $('#access-token').val("heroku config:add NODE_ENV="+accessToken);
  $('#access-token-wrapper').show();

});
