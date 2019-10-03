exports.db_username = '';
exports.db_password = '';
exports.db_name = 'mybasekit';
exports.db_host = '';
exports.db_url = '';
exports.db_protocol = 'http';
exports.db_port = 5984;
exports.superSecret = 'mybasekit';

if( process.env.VCAP_SERVICES ){
  var VCAP_SERVICES = JSON.parse( process.env.VCAP_SERVICES );
  if( VCAP_SERVICES && VCAP_SERVICES.cloudantNoSQLDB ){
    exports.db_username = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.username;
    exports.db_password = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.password;
    exports.db_host = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.host;
    exports.db_url = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.url;
    exports.db_port = VCAP_SERVICES.cloudantNoSQLDB[0].credentials.port;
  }
}
