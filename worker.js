var request = require('request');

// start doing a batch of work
exports.work = function(options, cbDone) {
  cbDone(null, {synced:0});
  
  // get current state
  // if none, initialize, /types, fitbit, runkeeper, etc
  // for each unit, async do them
  // if 'newest', kick off a sync forward
  // if no 'done'
    // if oldest, continue back, else sync backward and save 'oldest'
};


function getState(sha, cbDone)
{
  if(!sha) return cbDone(null, {count:0});
  
  proxy({url:'/repos/quartzjer/me/git/blobs/'+sha}, function(e, r, j){
    if(e) return cbDone(e);
    var content = (j.encoding == 'base64') ? new Buffer(j.content, 'base64').toString() : j.content;
    var js;
    try {
      js = JSON.parse(content);
    } catch(E) {
      return cbDone(E);
    }
    if(!js.count) js.count = 0;
    cbDone(null, js);
  });
}

function proxy(arg, cbDone)
{
  arg.url = 'https://api.singly.com/proxy/github'+arg.url+'?access_token='+token;
//  arg.url = 'http://localhost:8042/proxy/github'+arg.url+'?access_token='+token;
  arg.json = true;
  request(arg, cbDone);
}