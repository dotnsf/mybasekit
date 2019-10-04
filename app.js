//.  app.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    crypto = require( 'crypto' ),
    ejs = require( 'ejs' ),
    jwt = require( 'jsonwebtoken' ),
    session = require( 'express-session' ),
    items = require('./api/items'),
    users = require('./api/users'),
    app = express();
var settings = require( './settings' );

var db = null;
var cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
if( cloudant ){
  cloudant.db.get( settings.db_name, function( err, body ){
    if( err ){
      if( err.statusCode == 404 ){
        cloudant.db.create( settings.db_name, function( err, body ){
          if( err ){
            db = null;
          }else{
            db = cloudant.db.use( settings.db_name );
          }
        });
      }else{
        db = cloudant.db.use( settings.db_name );
      }
    }else{
      db = cloudant.db.use( settings.db_name );
    }
  });
}

app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.use( bodyParser.urlencoded( { limit: '10mb', extended: true } ) );
app.use( bodyParser.json() );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

app.use( '/api', users );
app.use( '/api', items );

app.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUnitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxage: 1000 * 60 * 60 * 24 * 30  //. 30 days
  }
}));


app.get( '/', function( req, res ){
  if( req.session && req.session.token ){
    //. トークンをデコード
    var token = req.session.token;
    jwt.verify( token, settings.superSecret, function( err, user ){
      if( err ){
        res.redirect( '/login?message=Invalid token.' );
      }else if( user && user.username ){
        res.render( 'index', { user: user } );
      }else{
        res.redirect( '/login?message=Invalid token.' );
      }
    });
  }else{
    res.redirect( '/login' );
  }
});

app.get( '/login', function( req, res ){
  var message = null;
  if( req.query.message ){
    message = req.query.message;
  }
  res.render( 'login', { message: message } );
});

app.post( '/login', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var username = req.body.username;
  var password = req.body.password;

  var hash = crypto.createHash( 'sha512' );
  hash.update( password );
  var hash_password = hash.digest( 'hex' );

  db.get( username, function( err, user ){
    if( err ){
      res.status( 400 );
      //res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
      res.write( JSON.stringify( { status: false, message: "wrong username and/or password." }, 2, null ) );
      res.end();
    }else{
      if( user.password && user.password == hash_password ){
        var token = jwt.sign( user, settings.superSecret, { expiresIn: '25h' } );
        req.session.token = token;
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: "wrong username and/or password." }, 2, null ) );
        res.end();
      }
    }
  });
});

app.post( '/logout', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  req.session.token = null;
  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});


var port = process.env.PORT || 3000;
app.listen( port );
console.log( "server starting on " + port + " ..." );
