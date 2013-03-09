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



// test removeListener

var foo = function() {
  console.log('foo');
};

var emitter = new (require('events').EventEmitter)();

emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);

console.log('Print 3 times');
emitter.emit('foo');
// should print foo 3 times

emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);
emitter.on('foo', foo);

emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);
emitter.removeListener('foo', foo);

console.log('Print once');
emitter.emit('foo');
// should print foo 1 time

should show { '0': 1, '1': 2, '2': 3 }
setTimeout(function () {console.log(arguments);}, 1000, 1, 2, 3);
//should show { '0': 1, '1': 2, '2': 3 }
setInterval(function () {console.log(arguments);}, 1000, 1, 2, 3);
