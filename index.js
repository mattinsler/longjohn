var EventEmitter = require('events').EventEmitter
  , filename = __filename
  , current_trace_error = null
  , in_prepare = 0;

exports.empty_frame = '---------------------------------------------';
exports.async_trace_limit = 10;

exports.format_stack_frame = function(frame) {
  if (frame.getFileName() === exports.empty_frame) { return exports.empty_frame; }
  
  var format_location = function(frame) {
    if (frame.isNative()) { return 'native'; }
    if (frame.isEval()) { return 'eval at ' + frame.getEvalOrigin(); }
    var file = frame.getFileName()
      , line = frame.getLineNumber()
      , column = frame.getColumnNumber();
    return !file ? 'unknown source' : file + (!line ? '' : ':' + line + (!column ? '' : ':' + column));
  };
  var format_method = function(frame) {
    var function_name = frame.getFunctionName();
    
    if (!(frame.isToplevel() || frame.isConstructor())) {
      var method = frame.getMethodName();
      return frame.getTypeName() + '.' + (!function_name ? method || '<anonymous>' : function_name + (method && method !== function_name ? ' [as ' + method + ']' : ''));
    }
    if (frame.isConstructor()) { return 'new ' + (function_name || '<anonymous>'); }
    if (function_name) { return function_name; }
    return null;
  };
  
  var method = format_method(frame)
    , location = format_location(frame);
  return '    at ' + (!method ? location : method + ' (' + location + ')');
};

exports.format_stack = function(err, frames) {
  var lines = [];
  try {
    lines.push(err.toString());
  } catch (e) {
    console.log('Caught error in longjohn.  Please report this to matt.insler@gmail.com.');
  }
  Array.prototype.push.apply(lines, frames.map(exports.format_stack_frame));
  return lines.join('\n');
};

var create_callsite = function(location) {
  return Object.create({
    getFileName: function() { return location; },
    getLineNumber: function() { return null; },
    getFunctionName: function() { return null; },
    getTypeName: function() { return null; },
    getMethodName: function() { return null; },
    getColumnNumber: function() { return null; },
    isNative: function() { return null; }
  });
};

Error.prepareStackTrace = function(error, structured_stack_trace) {
  error.__cached_trace__ = structured_stack_trace.filter(function(f) {
    return f.getFileName() !== filename;
  });
  
  if (!error.__previous__ && current_trace_error) {
    error.__previous__ = current_trace_error;
  }
  
  ++in_prepare;
  var previous_trace = error.__previous__ ? error.__previous__.stack : null;
  --in_prepare;
  if (previous_trace) {
    error.__cached_trace__.push(create_callsite(exports.empty_frame));
    Array.prototype.push.apply(error.__cached_trace__, previous_trace);
  }

  if (in_prepare > 0) { return error.__cached_trace__; }
  return exports.format_stack(error, error.__cached_trace__);
};

var limit_frames = function(stack) {
  if (exports.async_trace_limit <= 0 || (stack && stack.__trace_count__ < exports.async_trace_limit)) { return; }
  
  var count = 1
    , previous = stack;
  while (previous) {
    if (count >= exports.async_trace_limit) {
      delete previous.__previous__;
      return;
    }
    previous = previous.__previous__;
    ++count;
  }
};

var wrap_callback = function(callback, location) {
  var trace_error = new Error();
  trace_error.__location__ = location;
  trace_error.__previous__ = current_trace_error;
  trace_error.__trace_count__ = current_trace_error ? current_trace_error.__trace_count__ + 1 : 1;

  limit_frames(trace_error);
  
  var new_callback = function() {
    current_trace_error = trace_error;
    try {
      callback.apply(this, arguments);
    } catch (e) {
      // Ensure we're formatting the Error in longjohn
      e.stack;
      throw e;
    } finally {
      current_trace_error = null;
    }
  };
  
  new_callback.__original_callback__ = callback;
  return new_callback;
};



var _on = EventEmitter.prototype.on
  , _addListener = EventEmitter.prototype.addListener
  , _once = EventEmitter.prototype.once
  , _removeListener = EventEmitter.prototype.removeListener;

EventEmitter.prototype.addListener = function(event, callback) {
  return _addListener.call(this, event, wrap_callback(callback, 'EventEmitter.addListener'));
};

EventEmitter.prototype.on = function(event, callback) {
  return _on.call(this, event, wrap_callback(callback, 'EventEmitter.on'));
};

EventEmitter.prototype.once = function(event, callback) {
  return _once.call(this, event, wrap_callback(callback, 'EventEmitter.once'));
};

EventEmitter.prototype.removeListener = function(event, callback) {
  var _this = this;
  var find_listener = function(callback) {
    var is_callback = function(val) {
      return val.__original_callback__ === callback || (val.listener && val.listener.__original_callback__ === callback);
    };
    
    if (!_this._events || !_this._events[event]) { return null; }
    if (Array.isArray(_this._events[event])) {
      var x, listeners = _this._events[event] || [];
      for (x = 0; x < listeners.length; ++x) {
        if (is_callback(listeners[x])) {
          return listeners[x];
        }
      }
    } else if (is_callback(_this._events[event])) {
      return _this._events[event];
    }
    return null;
  };
    
  var listener = find_listener(callback);
  if (!listener || typeof(listener) !== 'function') { return this; }
  return _removeListener.call(this, event, listener);
}



var _nextTick = process.nextTick;

process.nextTick = function(callback) {
  return _nextTick.call(this, wrap_callback(callback, 'process.nextTick'));
};



var _setTimeout = global.setTimeout
  , _setInterval = global.setInterval;

global.setTimeout = function(callback, interval) {
  return _setTimeout.call(this, wrap_callback(callback, 'process.nextTick'), interval);
};

global.setInterval = function(callback, interval) {
  return _setInterval.call(this, wrap_callback(callback, 'process.nextTick'), interval);
};
