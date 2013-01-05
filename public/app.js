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

  $('#access-token').val(accessToken);
  $('#access-token-wrapper').show();

  // Get the user's profiles
  singly.get('/profiles', null, function(profiles) {
    _.each(Object.keys(profiles), function(profile) {
      if(profile !== 'id') {
        $('#profiles').append(sprintf(
          '<li><strong>Linked profile:</strong> %s</li>', profile));
      }
    });
  });

  // Get the 5 latest items from the user's statuses feed
  singly.get('/types/statuses_feed', { limit: 5 }, function(items) {
    _.each(items, function(item) {
      $('#statuses').append(sprintf('<li><strong>Status:</strong> %s</li>',
        item.oembed.text));
    });
  });
});
