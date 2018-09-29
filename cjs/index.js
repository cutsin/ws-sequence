'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _reconnectingWebsocket = require('reconnecting-websocket');

var _reconnectingWebsocket2 = _interopRequireDefault(_reconnectingWebsocket);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultBinaryType = typeof process !== 'undefined' && process.env.NODE_ENV === 'production' ? 'arraybuffer' : 'blob';
var ConnectedSockets = {};

var getMsg = function getMsg(evt) {
  var msg = evt.data;
  if (!msg) return evt;
  if (evt.data instanceof ArrayBuffer) {
    msg = new TextDecoder().decode(msg);
  }
  return JSON.parse(msg);
};

var WS = function () {
  function WS(_ref) {
    var _this = this;

    var uri = _ref.uri,
        _ref$binaryType = _ref.binaryType,
        binaryType = _ref$binaryType === undefined ? defaultBinaryType : _ref$binaryType,
        ping = _ref.ping;

    _classCallCheck(this, WS);

    this.uri = uri;
    this.binaryType = typeof TextEncoder === 'undefined' ? 'blob' : binaryType;
    this.id = 10;
    this.sendQueue = [];
    this.callbacks = new Map();
    // ping for no idle & never disconnect
    this.keeper = null;
    this.keeping = function () {
      clearTimeout(_this.keeper);
      _this.keeper = setTimeout(function () {
        _this.send(ping || '💧');
        _this.keeping();
      }, 55000);
    };

    var connected = ConnectedSockets[uri];
    if (connected) return this.ws = connected;
    this.ws = connected = ConnectedSockets[uri] = new _reconnectingWebsocket2.default(uri);
    // send msg records before open
    this.ws.addEventListener('open', function () {
      _this.ws.binaryType = _this.binaryType;
      while (_this.sendQueue.length) {
        _this.send(_this.sendQueue.shift());
      }
      _this.keeping();
    });
    // auto callback fn if req was specified msg id
    this.ws.addEventListener('message', function (evt) {
      var msg = getMsg(evt);
      var cb = _this.callbacks.get(msg.id);
      if (cb) {
        cb(msg.result || msg);
        _this.callbacks.delete(msg.id);
      }
    });
  }
  // send as sequence


  _createClass(WS, [{
    key: 'send',
    value: function send(req, cb) {
      var msg = req;
      if ((typeof msg === 'undefined' ? 'undefined' : _typeof(msg)) === 'object') {
        msg = Object.assign({}, msg, { id: this.id++ });
        // if (!msg.id) msg.id = this.id++
        if (cb) this.callbacks.set(msg.id, cb);
        msg = JSON.stringify(msg);
      }
      var data = this.binaryType === 'arraybuffer' ? new TextEncoder().encode(msg).buffer : msg;
      if (this.ws.readyState === 1) {
        this.ws.send(data);
      } else {
        this.sendQueue.push(msg);
      }
    }
  }, {
    key: 'on',
    value: function on(reqEvent, fn) {
      var listener = function listener(e) {
        return fn(getMsg(e));
      };
      this.ws.addEventListener(reqEvent, listener);
      return listener;
    }
  }, {
    key: 'off',
    value: function off(reqEvent, listener) {
      this.ws.removeEventListener(reqEvent, listener);
    }
  }]);

  return WS;
}();

exports.default = WS;