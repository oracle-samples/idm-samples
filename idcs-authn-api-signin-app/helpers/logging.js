

// var debugEnabled = process.env.DEBUG_LOGIN;

const isDebugEnabled = process.env.DEBUG_LOGIN;

function debugEnabled() {
  return isDebugEnabled;
}
exports.debugEnabled = debugEnabled;

function log( message ) {
  if ( !isDebugEnabled ) {
    return;
  }
  console.log(message);
}

exports.log = log;

function error( message ) {
  console.error(message);
}

exports.error = error;
