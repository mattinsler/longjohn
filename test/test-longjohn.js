var longjohn = require('../index')
  , assert = require("assert");

describe('longjohn', function() {
  it('should work with normal throw', function() {
    assert.throws(function() {
      throw new Error('foo');
    });
  });
  
  it('should work with errors from other modules', function(done) {
    var fs = require('fs');
    
    fs.readFile('not_there.txt', 'utf8', function(err, text) {
      if (err && err instanceof Error && err.stack === "Error: ENOENT, open 'not_there.txt'") {
        return done();
      }
      assert.fail();
    });
  });
  
  it('should track frames across setTimeout', function(done) {
    setTimeout(function() {
      console.log(new Error('foobar').stack);
    }, 1);
  });
  
  it('should allow stack size limiting', function(done) {
    longjohn.async_trace_limit = 2;

    var counter = 0;

    var foo = function() {
      if (++counter > 3) {
        assert.throws(function() {
          try {
            throw new Error('foo');
          } catch (e) {
            throw e;
          }
        }, function(err) {
          return err.stack.split(longjohn.empty_frame).length === 3;
        });
        return done();
      }
      setTimeout(foo, 1);
    }

    foo();
  });
  
  it('should work with on/emit', function() {
    var count = 0;
    
    var foo = function() {
      ++count;
    };
    
    var emitter = new (require('events').EventEmitter)();
    
    emitter.on('foo', foo);
    emitter.on('foo', foo);
    emitter.on('foo', foo);
    
    emitter.emit('foo');
    
    assert.equal(count, 3);
  });
  
  it('should work with removeListener', function() {
    var count = 0;
    
    var foo = function() {
      ++count;
    };
    
    var emitter = new (require('events').EventEmitter)();
    
    emitter.on('foo', foo);
    emitter.on('foo', foo);
    
    emitter.removeListener('foo', foo);
    
    emitter.emit('foo');
    
    assert.equal(count, 1);
  });
  
  it('should work with setTimeout', function(done) {
    setTimeout(function() {
      assert.deepEqual(Array.prototype.slice.call(arguments), [1, 2, 3]);
      done();
    }, 1000, 1, 2, 3);
  });
  
  it('should work with setInterval', function(done) {
    setInterval(function() {
      assert.deepEqual(Array.prototype.slice.call(arguments), [1, 2, 3]);
      done();
    }, 1000, 1, 2, 3);
  });
});
