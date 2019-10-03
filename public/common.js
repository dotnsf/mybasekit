
function logout(){
  $.ajax({
    type: 'POST',
    url: '/logout',
    data: {},
    success: function( data ){
      window.location.href = '/';
    },
    error: function(){
      window.location.href = '/';
    }
  });
}

function abbreviateArray( arr ){
  var str = '[';
  if( arr && Array.isArray( arr ) && arr.length > 0 ){
    if( typeof( arr[0] ) == 'string' ){
      str += '"' + arr[0] + '"';
    }else{
      str += arr[0];
    }
    if( arr.length > 1 ){
      str += ',..'
    }
  }
  str += ']';

  return str;
}
