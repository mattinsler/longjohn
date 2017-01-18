(function() {
  var ERROR_ID, EventEmitter, create_callsite, current_trace_error, filename, format_location, format_method, in_prepare, limit_frames, prepareStackTrace, source_map, wrap_callback, __nextDomainTick, _addListener, _listeners, _nextTick, _on, _ref, _setImmediate, _setInterval, _setTimeout;

  EventEmitter = require('events').EventEmitter;

  if ((_ref = EventEmitter.prototype.on) != null ? _ref['longjohn'] : void 0) {
    return module.exports = EventEmitter.prototype.on['longjohn'];
  }

  source_map = require('source-map-support');

  source_map.install();

  filename = __filename;

  current_trace_error = null;

  in_prepare = 0;

  exports.empty_frame = '---------------------------------------------';

  exports.async_trace_limit = 10;

  format_location = function(frame) {
    var column, file, line;
    if (frame.isNative()) {
      return 'native';
    }
    if (frame.isEval()) {
      return 'eval at ' + frame.getEvalOrigin();
    }
    file = frame.getFileName();
    file = frame.getFileName() || '<anonymous>';
    line = frame.getLineNumber();
    column = frame.getColumnNumber();
    column = column != null ? ':' + column : '';
    line = line != null ? ':' + line : '';
    return file + line + column;
  };

  format_method = function(frame) {
    var function_name, method, type;
    function_name = frame.getFunctionName();
    if (!(frame.isToplevel() || frame.isConstructor())) {
      method = frame.getMethodName();
      type = frame.getTypeName();
      if (function_name == null) {
        return "" + type + "." + (method != null ? method : '<anonymous>');
      }
      if (method === function_name) {
        return "" + type + "." + function_name;
      }
      "" + type + "." + function_name + " [as " + method + "]";
    }
    if (frame.isConstructor()) {
      return "new " + (function_name != null ? function_name : '<anonymous>');
    }
    if (function_name != null) {
      return function_name;
    }
    return null;
  };

  exports.format_stack_frame = function(frame) {
    if (frame.getFileName() === exports.empty_frame) {
      return exports.empty_frame;
    }
    return '    at ' + source_map.wrapCallSite(frame);
  };

  exports.format_stack = function(err, frames) {
    var e, lines;
    lines = [];
    try {
      lines.push(err.toString());
    } catch (_error) {
      e = _error;
      console.log('Caught error in longjohn. Please report this to matt.insler@gmail.com.');
    }
    lines.push.apply(lines, frames.map(exports.format_stack_frame));
    return lines.join('\n');
  };

  create_callsite = function(location) {
    return Object.create({
      getFileName: function() {
        return location;
      },
      getLineNumber: function() {
        return null;
      },
      getFunctionName: function() {
        return null;
      },
      getTypeName: function() {
        return null;
      },
      getMethodName: function() {
        return null;
      },
      getColumnNumber: function() {
        return null;
      },
      isNative: function() {
        return null;
      }
    });
  };

  prepareStackTrace = function(error, structured_stack_trace) {
    var previous_stack, _ref1;
    ++in_prepare;
    if (error.__cached_trace__ == null) {
      Object.defineProperty(error, '__cached_trace__', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: structured_stack_trace.filter(function(f) {
          return f.getFileName() !== filename;
        })
      });
      if ((error.__previous__ == null) && in_prepare === 1) {
        Object.defineProperty(error, '__previous__', {
          writable: true,
          enumerable: false,
          configurable: true,
          value: current_trace_error
        });
      }
      if (error.__previous__ != null) {
        previous_stack = prepareStackTrace(error.__previous__, error.__previous__.__stack__);
        if ((previous_stack != null ? previous_stack.length : void 0) > 0) {
          error.__cached_trace__.push(create_callsite(exports.empty_frame));
          (_ref1 = error.__cached_trace__).push.apply(_ref1, previous_stack);
        }
      }
    }
    --in_prepare;
    if (in_prepare > 0) {
      return error.__cached_trace__;
    }
    return exports.format_stack(error, error.__cached_trace__);
  };

  limit_frames = function(stack) {
    var count, previous;
    if (exports.async_trace_limit <= 0) {
      return;
    }
    count = exports.async_trace_limit - 1;
    previous = stack;
    while ((previous != null) && count > 1) {
      previous = previous.__previous__;
      --count;
    }
    if (previous != null) {
      return delete previous.__previous__;
    }
  };

  ERROR_ID = 1;

  wrap_callback = function(callback, location) {
    var new_callback, orig, trace_error;
    orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(x, stack) {
      return stack;
    };
    trace_error = new Error();
    Error.captureStackTrace(trace_error, arguments.callee);
    trace_error.__stack__ = trace_error.stack;
    Error.prepareStackTrace = orig;
    trace_error.id = ERROR_ID++;
    if (trace_error.stack[1]) {
      trace_error.location = "" + (trace_error.stack[1].getFunctionName()) + " (" + (trace_error.stack[1].getFileName()) + ":" + (trace_error.stack[1].getLineNumber()) + ")";
    } else {
      trace_error.location = 'bad call_stack_location';
    }
    trace_error.__location__ = location;
    trace_error.__previous__ = current_trace_error;
    trace_error.__trace_count__ = current_trace_error != null ? current_trace_error.__trace_count__ + 1 : 1;
    limit_frames(trace_error);
    new_callback = function() {
      var e;
      current_trace_error = trace_error;
      trace_error = null;
      try {
        return callback.apply(this, arguments);
      } catch (_error) {
        e = _error;
        e.stack;
        throw e;
      } finally {
        current_trace_error = null;
      }
    };
    new_callback.listener = callback;
    return new_callback;
  };

  _on = EventEmitter.prototype.on;

  _addListener = EventEmitter.prototype.addListener;

  _listeners = EventEmitter.prototype.listeners;

  EventEmitter.prototype.addListener = function(event, callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[1] = wrap_callback(callback, 'EventEmitter.addListener');
    return _addListener.apply(this, args);
  };

  EventEmitter.prototype.on = function(event, callback) {
    var args, g, wrap;
    args = Array.prototype.slice.call(arguments);
    if (callback.listener) {
      wrap = wrap_callback(callback.listener, 'EventEmitter.once');
      g = function() {
        var fired;
        this.removeListener(event, g);
        if (!fired) {
          fired = true;
          return wrap.apply(this, arguments);
        }
      };
      g.listener = callback.listener;
    } else {
      g = wrap_callback(callback, 'EventEmitter.on');
    }
    args[1] = g;
    return _on.apply(this, args);
  };

  EventEmitter.prototype.listeners = function(event) {
    var l, listeners, unwrapped, _i, _len;
    listeners = _listeners.call(this, event);
    unwrapped = [];
    for (_i = 0, _len = listeners.length; _i < _len; _i++) {
      l = listeners[_i];
      if (l.listener) {
        unwrapped.push(l.listener);
      } else {
        unwrapped.push(l);
      }
    }
    return unwrapped;
  };

  Object.defineProperty(EventEmitter.prototype.on, 'longjohn', {
    writable: true,
    enumerable: false,
    configurable: true,
    value: this
  });

  _nextTick = process.nextTick;

  process.nextTick = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'process.nextTick');
    return _nextTick.apply(this, args);
  };

  __nextDomainTick = process._nextDomainTick;

  process._nextDomainTick = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'process.nextDomainTick');
    return __nextDomainTick.apply(this, args);
  };

  _setTimeout = global.setTimeout;

  _setInterval = global.setInterval;

  global.setTimeout = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'global.setTimeout');
    return _setTimeout.apply(this, args);
  };

  global.setInterval = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'global.setInterval');
    return _setInterval.apply(this, args);
  };

  if (global.setImmediate != null) {
    _setImmediate = global.setImmediate;
    global.setImmediate = function(callback) {
      var args;
      args = Array.prototype.slice.call(arguments);
      args[0] = wrap_callback(callback, 'global.setImmediate');
      return _setImmediate.apply(this, args);
    };
  }

  Error.prepareStackTrace = prepareStackTrace;

  if (process.env.NODE_ENV === 'production') {
    console.warn('NOTICE: Longjohn is known to cause CPU usage due to its extensive data collection during runtime.\nIt generally should not be used in production applications.');
  }

}).call(this);
