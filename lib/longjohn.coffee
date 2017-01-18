{EventEmitter} = require 'events'
if EventEmitter.prototype.on?['longjohn']
  return module.exports = EventEmitter.prototype.on['longjohn']

source_map = require 'source-map-support'
source_map.install()

filename = __filename
current_trace_error = null
in_prepare = 0

exports.empty_frame = '---------------------------------------------'
exports.async_trace_limit = 10

format_location = (frame) ->
  return 'native' if frame.isNative()
  return 'eval at ' + frame.getEvalOrigin() if frame.isEval()

  file = frame.getFileName()
  file = frame.getFileName() || '<anonymous>'
  line = frame.getLineNumber()
  column = frame.getColumnNumber()

  column = if column? then ':' + column else ''
  line = if line? then ':' + line else ''

  file + line + column

format_method = (frame) ->
  function_name = frame.getFunctionName()

  unless frame.isToplevel() or frame.isConstructor()
    method = frame.getMethodName()
    type = frame.getTypeName()
    return "#{type}.#{method ? '<anonymous>'}" unless function_name?
    return "#{type}.#{function_name}" if method is function_name
    "#{type}.#{function_name} [as #{method}]"

  return "new #{function_name ? '<anonymous>'}" if frame.isConstructor()
  return function_name if function_name?
  null

exports.format_stack_frame = (frame) ->
  return exports.empty_frame if frame.getFileName() is exports.empty_frame
  return '    at ' + source_map.wrapCallSite(frame)

exports.format_stack = (err, frames) ->
  lines = []
  try
    lines.push(err.toString())
  catch e
    console.log 'Caught error in longjohn. Please report this to matt.insler@gmail.com.'
  lines.push(frames.map(exports.format_stack_frame)...)
  lines.join('\n')

create_callsite = (location) ->
  Object.create {
    getFileName: -> location
    getLineNumber: -> null
    getFunctionName: -> null
    getTypeName: -> null
    getMethodName: -> null
    getColumnNumber: -> null
    isNative: -> null
  }

prepareStackTrace = (error, structured_stack_trace) ->
  ++in_prepare

  unless error.__cached_trace__?
    Object.defineProperty(error, '__cached_trace__', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: structured_stack_trace.filter (f) -> f.getFileName() isnt filename
    });
    if !error.__previous__? and in_prepare is 1
      Object.defineProperty(error, '__previous__', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: current_trace_error
      });

    if error.__previous__?
      previous_stack =prepareStackTrace(error.__previous__, error.__previous__.__stack__)
      if previous_stack?.length > 0
        error.__cached_trace__.push(create_callsite(exports.empty_frame))
        error.__cached_trace__.push(previous_stack...)

  --in_prepare

  return error.__cached_trace__ if in_prepare > 0
  exports.format_stack(error, error.__cached_trace__)

limit_frames = (stack) ->
  return if exports.async_trace_limit <= 0

  count = exports.async_trace_limit - 1
  previous = stack

  while previous? and count > 1
    previous = previous.__previous__
    --count
  delete previous.__previous__ if previous?

ERROR_ID = 1

wrap_callback = (callback, location) ->
  orig = Error.prepareStackTrace
  Error.prepareStackTrace = (x, stack) -> stack
  trace_error = new Error()
  Error.captureStackTrace(trace_error, arguments.callee)
  trace_error.__stack__ = trace_error.stack;
  Error.prepareStackTrace = orig
  trace_error.id = ERROR_ID++
  if trace_error.stack[1]
    trace_error.location = "#{trace_error.stack[1].getFunctionName()} (#{trace_error.stack[1].getFileName()}:#{trace_error.stack[1].getLineNumber()})";
  else
    trace_error.location = 'bad call_stack_location'
  trace_error.__location__ = location
  trace_error.__previous__ = current_trace_error
  trace_error.__trace_count__ = if current_trace_error? then current_trace_error.__trace_count__ + 1 else 1

  limit_frames(trace_error)

  new_callback = ->
    current_trace_error = trace_error
    # Clear trace_error variable from the closure, so it can potentially be garbage collected.
    trace_error = null

    try
      callback.apply(this, arguments)
    catch e
      # Ensure we're formatting the Error in longjohn
      e.stack
      throw e
    finally
      current_trace_error = null

  new_callback.listener = callback
  new_callback



_on = EventEmitter.prototype.on
_addListener = EventEmitter.prototype.addListener
_listeners = EventEmitter.prototype.listeners

EventEmitter.prototype.addListener = (event, callback) ->
  args = Array::slice.call(arguments)
  args[1] = wrap_callback(callback, 'EventEmitter.addListener')
  _addListener.apply(this, args)

EventEmitter.prototype.on = (event, callback) ->
  args = Array::slice.call(arguments)

  # Coming from EventEmitter.prototype.once
  if callback.listener
    wrap = wrap_callback(callback.listener, 'EventEmitter.once');

    g = () ->
      this.removeListener(event, g)

      if !fired
        fired = true
        wrap.apply(this, arguments)

    g.listener = callback.listener;
  else
    g = wrap_callback(callback, 'EventEmitter.on')

  args[1] = g;

  _on.apply(this, args)

EventEmitter.prototype.listeners = (event) ->
  listeners = _listeners.call(this, event)
  unwrapped = []
  for l in listeners
    if l.listener
      unwrapped.push l.listener
    else
      unwrapped.push l
  return unwrapped

Object.defineProperty(EventEmitter.prototype.on, 'longjohn', {
  writable: true,
  enumerable: false,
  configurable: true,
  value: this
});

_nextTick = process.nextTick

process.nextTick = (callback) ->
  args = Array::slice.call(arguments)
  args[0] = wrap_callback(callback, 'process.nextTick')
  _nextTick.apply(this, args)


__nextDomainTick = process._nextDomainTick

process._nextDomainTick = (callback) ->
  args = Array::slice.call(arguments)
  args[0] = wrap_callback(callback, 'process.nextDomainTick')
  __nextDomainTick.apply(this, args)


_setTimeout = global.setTimeout
_setInterval = global.setInterval

global.setTimeout = (callback) ->
  args = Array::slice.call(arguments)
  args[0] = wrap_callback(callback, 'global.setTimeout')
  _setTimeout.apply(this, args)

global.setInterval = (callback) ->
  args = Array::slice.call(arguments)
  args[0] = wrap_callback(callback, 'global.setInterval')
  _setInterval.apply(this, args)

if global.setImmediate?
  _setImmediate = global.setImmediate

  global.setImmediate = (callback) ->
    args = Array::slice.call(arguments)
    args[0] = wrap_callback(callback, 'global.setImmediate')
    _setImmediate.apply(this, args)

Error.prepareStackTrace = prepareStackTrace

if process.env.NODE_ENV == 'production'
  console.warn '''
    NOTICE: Longjohn is known to cause CPU usage due to its extensive data collection during runtime.
    It generally should not be used in production applications.
  '''
