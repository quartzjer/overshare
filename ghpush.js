var url = require('url');
var request = require('request');
var qs = require('querystring');
var token = process.argv[2];

proxy({url:'/repos/quartzjer/me/git/refs/heads/master'}, function(e, r, j){
  if(e) return console.log(e);
  var commitsha = j.object.sha;
  proxy({url:'/repos/quartzjer/me/git/commits/'+commitsha}, function(e, r, j){
    if(e) return console.log(e);
    var treesha = j.tree.sha;
    proxy({url:'/repos/quartzjer/me/git/trees/'+treesha}, function(e, r, j){
      if(e) return console.log(e);
      var statesha;
      j.tree.forEach(function(blob){ if(blob.path == 'state.json') statesha = blob.sha; });
      getState(statesha, function(e, state){
        if(e) return console.log(e);
        state.count++;
        var data = {base_tree:treesha, tree:[{path:'state.json', content:JSON.stringify(state)}]};
        proxy({url:'/repos/quartzjer/me/git/trees', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify(data)}, function(e, r, j){
          if(e) return console.log(e);
          var data = {message:"autocommit", parents:[commitsha], tree:j.sha};
          proxy({url:'/repos/quartzjer/me/git/commits', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify(data)}, function(e, r, j){
            if(e) return console.log(e);
            var data = {sha:j.sha};
            proxy({url:'/repos/quartzjer/me/git/refs/heads/master', method:'POST', headers:{'content-type':'application/javascript'}, body:JSON.stringify(data)}, function(e, r, j){
              if(e) return console.log(e);
              console.log(r.statusCode,j);

            });      
          });      
        });
      });
    });
  });
});


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