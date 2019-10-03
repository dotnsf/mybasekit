//. users.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    crypto = require( 'crypto' ),
    fs = require( 'fs' ),
    jwt = require( 'jsonwebtoken' ),
    session = require( 'express-session' ),
    router = express.Router();
var settings = require( '../settings' );

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

router.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUnitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxage: 1000 * 60 * 60 * 24 * 30  //. 30 days
  }
}));

router.use( bodyParser.urlencoded( { limit: '10mb', extended: true } ) );
router.use( bodyParser.json() );

router.post( '/login', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var username = req.body.username;
  var password = req.body.password;

  var hash = crypto.createHash( 'sha512' );
  hash.update( password );
  var hash_password = hash.digest( 'hex' );

  db.get( username, function( err, user ){
    if( err ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
      res.end();
    }else{
      if( user.password && user.password == hash_password ){
        var token = jwt.sign( user, settings.superSecret, { expiresIn: '25h' } );
        req.session.token = token;
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: "wrong password." }, 2, null ) );
        res.end();
      }
    }
  });
});

router.post( '/logout', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  req.session.token = null;
  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});

router.post( '/adminuser', function( req, res ){
  res.contentType( 'application/json' );
  var id = 'admin'; //req.body.id;
  var password = req.body.password;
  if( !password ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No password provided.' }, 2, null ) );
    res.end();
  }else{
    db.get( id, function( err, doc ){
      if( !err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'User ' + id + ' already existed.' }, 2, null ) );
        res.end();
      }else{
        var user = {
           _id: id,
           username: id,
           //password: password,
           name: 'admin',
           type: 'user',
           role: 'admin',
           timestamp: ( new Date() ).getTime()
        };
        var hash = crypto.createHash( 'sha512' );
        hash.update( password );
        user.password = hash.digest( 'hex' );

        db.insert( user, function( err, body ){
          if( err ){
            console.log( err );
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
            res.end();
          }else{
            res.write( JSON.stringify( { status: true, message: body }, 2, null ) );
            res.end();
          }
        });
      }
    });
  }
});


//. ここより上で定義する API には認証フィルタをかけない
//. ここより下で定義する API には認証フィルタをかける

router.use( function( req, res, next ){
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    return res.status( 403 ).send( { status: false, message: 'No token provided.' } );
  }

  jwt.verify( token, settings.superSecret, function( err, decoded ){
    if( err ){
      return res.json( { status: false, message: 'Invalid token.' } );
    }

    req.decoded = decoded;  //. req.decoded = ログイン済み user のオブジェクト
    next();
  });
});


router.post( '/user', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    if( req.decoded.role && req.decoded.role == "admin" ){
      var user = req.body; //. { username: "username", password: "password", role: "role" }
      user._id = user.username;
      user.type = 'user';
      user.timescamp = ( new Date() ).getTime();

      var hash = crypto.createHash( 'sha512' );
      hash.update( user.password );
      user.password = hash.digest( 'hex' );

      db.insert( user, function( err, body ){
        if( err ){
          console.log( err );
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
          res.end();
        }else{
          res.write( JSON.stringify( { status: true, message: body }, 2, null ) );
          res.end();
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'No permission.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});

router.get( '/users', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
    var offset = req.query.offset ? parseInt( req.query.offset ) : 0;

    if( db ){
      var q = {
        selector: {
          type: { "$eq": "user" }
        }
      };

      //if( limit ){ q.limit = limit; }
      //if( offset ){ q.offset = offset; }

      db.find( q ).then( ( body ) => {
        var docs = [];
        body.docs.forEach( function( doc ){
          console.log( doc );
          switch( req.decoded.role ){
          case "admin":
            docs.push( doc );
            break;
          default:
            if( req.docoded._id == doc._id ){
              docs.push( doc );
            }
            break;
          }

          //console.log( body );
          if( offset ){
            if( limit ){
              docs = docs.slice( offset, offset + limit );
            }else{
              docs = docs.slice( offset );
            }
          }
          var result = { status: true, limit: limit, offset: offset, items: docs };
          res.write( JSON.stringify( result, 2, null ) );
          res.end();
        });
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});

router.get( '/user/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    var id = req.params.id;
    if( db ){
      db.get( id, function( err, body ){
        if( err ){
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
          res.end();
        }else{
          if( req.decoded.role == "admin" || req.decoded._id == body.user_id ){
            res.write( JSON.stringify( { status: true, user: body }, 2, null ) );
            res.end();
          }else{
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: 'No permission.' }, 2, null ) );
            res.end();
          }
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});


router.delete( '/user/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    var id = req.params.id;
    if( db && id ){
      db.get( id, function( err, doc ){
        if( err ){
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
          res.end();
        }else{
          if( req.decoded.role == "admin" || req.decoded._id == doc.user_id ){
            db.destroy( id, doc._rev, function( err, body ){
              if( err ){
                res.status( 400 );
                res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
                res.end();
              }else{
                res.write( JSON.stringify( { status: true }, 2, null ) );
                res.end();
              }
            });
          }else{
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: 'No permission.' }, 2, null ) );
            res.end();
          }
        }
      });
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});


module.exports = router;
