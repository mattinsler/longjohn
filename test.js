// These tests should be run one at a time.  Comment the others out before running

var fs = require('fs')
  , longjohn = require('./index');


// Throw immediate error
throw new Error('foo');



// Report error from another module
fs.readFile('not_there.txt', 'utf8', function(err, text) {
  console.log(err.stack);
});



// Throw through setTimeout and cut the stack off at 2 async calls
longjohn.async_trace_limit = 2;

var counter = 0;

var foo = function() {
  if (counter++ >= 10) {
    throw new Error('foo');
  }
  console.log('Foo');
  setTimeout(foo, 1000);
}

foo();
