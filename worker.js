var request = require('request');
var async = require('async');
var urllib = require('url');

// list of the api paths to sync data from, /types/all gets most common things
var SYNC = ["/types/all", "/services/runkeeper/fitness_activities", "/services/fitbit/activities"];

// BIG shout out to Matt Swanson for the guide at http://swanson.github.com/blog/2011/07/23/digging-around-the-github-api-take-2.html 

// start doing a batch of sync work
// options is {token:X, repo:Y, user:Z}
exports.work = function(options, cbDone) {
  console.log("starting work",options);
  // first init the github vars to make the commit and get the current state
  init(options, function(e, state){
    // first time, init
    if(!state.units) {
      state.units = {};
      SYNC.forEach(function(path){ state.units[path] = {}; });
    }

    options.total = 0;
    options.more = 0;
    console.log("running units",state);
    async.forEach(Object.keys(state.units), function(path, cbUnit){
      // try to sync forward from the last time, if any
      unitNewer(options, path, state.units[path], function(){
        // also try to page backward for older existing data, if any
        unitOlder(options, path, state.units[path], cbUnit);
      })
    }, function(){
      // update state and actually save it all!
      state.lastTotal = options.total;
      state.lastRun = Date.now();
      addFile(options, 'state.json', state);
      console.log("committing",options,state);
      commit(options, function(e){
        if(e) console.log("commit fail",e);
        // return options which has a .total and .more flag
        cbDone(e, options);
      });
    });
  });  
};

// start building up the commit
function addFile(options, name, data)
{
  if(!options.tree) options.tree = [];
  options.tree.push({path:name, content:JSON.stringify(data)});
}

// just construct a nice name/path
function saveEntry(options, entry)
{
  var id = urllib.parse(entry.idr);
  addFile(options, [id.host, id.pathname, entry.id].join('/')+'.json', entry);
}

// sync forward in time
function unitNewer(options, path, unit, cbDone)
{
  // first time
  if(!unit.since) {
    unit.since = Date.now();
    return cbDone();
  }
  
  getPage(options, path, {since:unit.since, limit:20}, function(results){
    if(!results) return cbDone()
    options.total += results.length;
    if(results.length == 20) options.more = true;
    results.forEach(function(entry){
      if(entry.at > unit.since) unit.since = entry.at;
      saveEntry(options, entry);
    })
  });
}

// sync backward in time
function unitOlder(options, path, unit, cbDone)
{
  // skip through if we did this once
  if(unit.done) return cbDone();

  if(!unit.until) unit.until = Date.now();
  
  getPage(options, path, {until:unit.until, limit:20}, function(results){
    if(!results) return cbDone()
    options.total += results.length;
    if(results.length == 20) options.more = true;
    if(results.length == 0) unit.done = true;
    results.forEach(function(entry){
      if(entry.at < unit.until) unit.until = entry.at;
      saveEntry(options, entry);
    })
  });
}

// fetch from the singly api, don't return errors just log them
function getPage(options, path, args, cbResults)
{
  var url = 'https://api.singly.com'+path;
  args.access_token = options.token;
  request({uri:url, json:true, qs:args}, function(e, r, j){
    if(e || r.statusCode != 200) console.log(url, args, e, r.statusCode, j);
    cbResults(Array.isArray(j) && j);
  });
}

// need some state info to create the checkin and get state
function init(options, cbDone)
{
  proxy(options, {url:'/refs/heads/master'}, function(e, r, j){
    if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
    options.commitsha = j.object.sha;
    proxy(options, {url:'/commits/'+options.commitsha}, function(e, r, j){
      if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
      options.treesha = j.tree.sha;
      proxy(options, {url:'/trees/'+options.treesha}, function(e, r, j){
        if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
        j.tree.forEach(function(blob){ if(blob.path == 'state.json') options.statesha = blob.sha; });
        getState(options, cbDone);
      });
    });
  });
}

function commit(options, cbDone)
{
  if(!options.tree) return cbDone("nothing to commit");
  proxy(options, {url:'/trees', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify({base_tree:options.treesha, tree:options.tree})}, function(e, r, j){
    if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
    var data = {message:"autocommit", parents:[options.commitsha], tree:j.sha};
    proxy({url:'/commits', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify(data)}, function(e, r, j){
      if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
      var data = {sha:j.sha};
      proxy({url:'/refs/heads/master', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify(data)}, function(e, r, j){
        if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
        cbDone(null, j);
      });      
    });      
  });
}

// fetch the contents of our state file
function getState(options, cbDone)
{
  if(!options.statesha) return cbDone(null, {created:Date.now()});
  
  proxy(options, {url:'/blobs/'+options.statesha}, function(e, r, j){
    if(e || r.statusCode != 200) return cbDone(e || [r.statusCode,j].join(" "));
    var content = (j.encoding == 'base64') ? new Buffer(j.content, 'base64').toString() : j.content;
    var js;
    try {
      js = JSON.parse(content);
    } catch(E) {
      return cbDone(E);
    }
    cbDone(null, js);
  });
}

// simple wrapper to hit github api auth'd
function proxy(options, arg, cbDone)
{
  arg.url = 'https://api.singly.com/proxy/github/repos/'+options.user+'/'+options.repo+'/git'+arg.url+'?access_token='+options.token;
  arg.json = true;
  request(arg, cbDone);
}