//. items.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    crypto = require( 'crypto' ),
    fs = require( 'fs' ),
    jwt = require( 'jsonwebtoken' ),
    multer = require( 'multer' ),
    session = require( 'express-session' ),
    router = express.Router();
var XLSX = require( 'xlsx' );
var Utils = XLSX.utils;
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

//router.use( multer( { dest: './tmp/' } ).single( 'file' ) );
var upload = multer( { dest: '../tmp/' } );
router.use( bodyParser.urlencoded( { limit: '10mb', extended: true } ) );
router.use( bodyParser.json() );


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

    req.decoded = decoded;
    next();
  });
});


router.post( '/upload', upload.single( 'file' ), function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    if( req.file && req.file.path ){
      var path = req.file.path;
      var type = req.file.mimetype;
      var filename = req.file.originalname;
      var id = req.params.id;

      if( filetype.indexOf( 'excel' ) == -1 && filetype.indexOf( 'openxmlformats-officedocument.spreadsheetml' ) == -1 ){
        if( filepath ){ fs.unlink( filepath, function( err ){} ); }
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'Excel file need to be attached.' }, 2, null ) );
        res.end();
      }else{
        var book = XLSX.readFile( path );
        for( sheetname in book.Sheets ){
          var sheet = book.Sheets[sheetname];
          var range = sheet['!ref'];  //. "A1:C39"
          var decodeRange = Utils.decode_range( range );

          for( var r = decodeRange.s.r; r <= decodeRange.e.r; r ++ ){
            for( var c = decodeRange.s.c; c <= decodeRange.e.c; c ++ ){
              var address = Utils.encode_cell( { r: r, c: c } );
              var cell = sheet[address];
              if( typeof cell !== "undefined" && typeof cell.v !== "undefined" && cell.w ){
              }else{
              }
            }
          }
        }

        res.write( JSON.stringify( { status: true, filename: filename }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, err: 'no file found.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});

router.post( '/item', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    //var id = uuidv1();
    var item = req.body;
    item.type = 'item';
    item.timescamp = ( new Date() ).getTime();

    db.insert( item, function( err, body ){
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
    res.status( 401 );
    res.write( JSON.stringify( { status: false, message: 'No token provided.' }, 2, null ) );
    res.end();
  }
});

router.get( '/items', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( req.decoded ){
    var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
    var offset = req.query.offset ? parseInt( req.query.offset ) : 0;

    if( db ){
      var q = {
        selector: {
          type: { "$eq": "item" }
        }
      };
      if( limit ){ q.limit = limit; }
      if( offset ){ q.offset = offset; }
      db.find( q ).then( ( body ) => {
        //console.log( body );
        var result = { status: true, limit: limit, offset: offset, items: body.docs };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
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

router.get( '/item/:id', function( req, res ){
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
          res.write( JSON.stringify( { status: true, item: body }, 2, null ) );
          res.end();
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


router.delete( '/item/:id', function( req, res ){
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
