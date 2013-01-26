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
  if (!githubProfile) return;

  $('#repo-block').css({ 'visibility': 'visible'});
  $('#repo-block').html("loading list of repos...");
  singly.get('/proxy/github/user/repos', {type:'owner', sort:'created'}, function(data){
    if (!data) {
      $('#repo-block').html("failed to fetch from github, reload?");
      return;
    }
    var repolist = "<blockquote><ul>";
    data.forEach(function(repo){
      repolist += "<li><a href='/generate?repo="+repo.name+"'>"+repo.name+"</a</li>";
    })
    repolist += "</ul></blockquote>";
    $('#repo-block').html(repolist);
  });

});

