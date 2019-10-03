//.  app.js
var express = require( 'express' ),
    ejs = require( 'ejs' ),
    items = require('./api/items'),
    users = require('./api/users'),
    app = express();
var settings = require( './settings' );

app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

app.use( '/api', users );
app.use( '/api', items );


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
  res.render( 'login', {} );
});

var port = process.env.PORT || 3000;
app.listen( port );
console.log( "server starting on " + port + " ..." );
