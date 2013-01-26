// USAGE:
//
// If you have foreman (you should!) set you .env file with
// SINGLY_CLIENT_ID and SINGLY_CLIENT_SECRET and then run:
//
// $ foreman start
//
// Otherwise set SINGLY_CLIENT_ID and SINGLY_CLIENT_SECRET env vars and run:
//
// $ node app

var express = require('express');
var querystring = require('querystring');
var request = require('request');
var sprintf = require('sprintf').sprintf;
var partials = require('express-partials');
var serializer = require('serializer');
var worker = require('./worker');

// The port that this express app will listen on
var port = process.env.PORT || 7464;

// Your client ID and secret from http://dev.singly.com/apps
var clientId = process.env.SINGLY_CLIENT_ID;
var clientSecret = process.env.SINGLY_CLIENT_SECRET;

// used to create encrypted unique worker url
var serialize = serializer.createSecureSerializer(clientSecret, clientSecret);

// Require and initialize the singly module
var singly = require('singly')(clientId, clientSecret);

var apiBaseUrl = process.env.SINGLY_API_HOST || 'https://api.singly.com';

// Create an HTTP server
var app = express();

// Setup for the express web framework
app.configure(function() {
  // Use ejs instead of jade because HTML is easy
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.logger());
  app.use(express['static'](__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: clientSecret || '42'}));
  app.use(app.router);
});

// We want exceptions and stracktraces in development
app.configure('development', function() {
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

function authorizationLink(req) {
  var returning = req && req.session && req.session.profiles;

  return function(service, name) {
    if (returning && req.session.profiles[service] !== undefined) {
      return '<span class="check">&#10003;</span> ' + name;
    }

    var options = {
      client_id: clientId,
      redirect_uri: 'http://'+req.headers.host+'/callback',
      service: service
    };

    // set account to the user's Singly id for profile merging
    // see https://singly.com/docs/authorization
    if (returning && req.session.profiles.id) {
      options.access_token = req.session.accessToken;
    }
    else {
      options.account = 'false';
    }

    var url = apiBaseUrl + '/oauth/authenticate?' + querystring.stringify(options)
    return sprintf('<a href="%s">%s</a>', url, name);
  };
}

// Render out views/index.ejs, passing in the session
app.get('/', function(req, res) {
  if(!clientSecret) return res.send("missing SINGLY_CLIENT_ID and SINGLY_CLIENT_SECRET settings", 500);
  res.locals.authorizationLink = authorizationLink(req);
  res.render('index', {
    session: req.session
  });
});

// oauth2 handler
app.get('/callback', function(req, res) {
  var code = req.param('code');

  // Exchange the OAuth2 code for an access token
  singly.getAccessToken(code, function(err, accessTokenRes, token) {
    // Save the token for future API requests
    req.session.accessToken = token.access_token;

    // Fetch the user's service profile data
    singly.get('/profiles', { access_token: token.access_token },
      function(err, profiles) {
      req.session.profiles = profiles.body;

      res.redirect('/');
    });
  });
});

// need to encrypt the singly token+repo server-side
app.get('/generate', function(req, res) {
  if (!req.session.accessToken) return res.json({err:"missing token"}, 500);
  if (!req.query.repo) return res.json({err:"missing repo"}, 500);
  var workKey = serialize.stringify({token:req.session.accessToken, repo:req.query.repo, created:Date.now()});
  res.json({key:workKey});
});

// actually perform the work, broke out into a different file
app.get('/work', function(req, res) {
  if (!req.query.key) return res.send("missing work key", 500);
  var options;
  try {
    options = serialize.parse(req.query.key);
  } catch(E) {}
  if (!options) return res.send("invalid work key", 500);  
  
  worker.work(options, function(err, results){
    if(err) res.send(err, 500);
    res.send("sync'd "+results.synced+" items");
  });
});

app.listen(port);

console.log(sprintf('Listening on port %s using API endpoint %s.', port, apiBaseUrl));
