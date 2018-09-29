import ReconnectingWebSocket from 'reconnecting-websocket'

const defaultBinaryType = typeof process !== 'undefined' && process.env.NODE_ENV === 'production' ? 'arraybuffer' : 'blob'
const ConnectedSockets = {}

const getMsg = evt => {
  let msg = evt.data
  if (!msg) return evt
  if (evt.data instanceof ArrayBuffer) {
    msg = new TextDecoder().decode(msg)
  }
  return JSON.parse(msg)
}

class WS {
  constructor ({uri, binaryType = defaultBinaryType, ping}) {
    this.uri = uri
    this.binaryType = typeof TextEncoder === 'undefined' ? 'blob' : binaryType
    this.id = 10
    this.sendQueue = []
    this.callbacks = new Map()
    // ping for no idle & never disconnect
    this.keeper = null
    this.keeping = () => {
      clearTimeout(this.keeper)
      this.keeper = setTimeout(() => {
        this.send(ping || '💧')
        this.keeping()
      }, 55000)
    }

    let connected = ConnectedSockets[uri]
    if (connected) return (this.ws = connected)
    this.ws = connected = ConnectedSockets[uri] = new ReconnectingWebSocket(uri)
    // send msg records before open
    this.ws.addEventListener('open', () => {
      this.ws.binaryType = this.binaryType
      while (this.sendQueue.length) {
        this.send(this.sendQueue.shift())
      }
      this.keeping()
    })
    // auto callback fn if req was specified msg id
    this.ws.addEventListener('message', (evt) => {
      const msg = getMsg(evt)
      const cb = this.callbacks.get(msg.id)
      if (cb) {
        cb(msg.result || msg)
        this.callbacks.delete(msg.id)
      }
    })
  }
  // send as sequence
  send (req, cb) {
    let msg = req
    if (typeof msg === 'object') {
      msg = Object.assign({}, msg, {id: this.id++})
      // if (!msg.id) msg.id = this.id++
      if (cb) this.callbacks.set(msg.id, cb)
      msg = JSON.stringify(msg)
    }
    const data = this.binaryType === 'arraybuffer' ? new TextEncoder().encode(msg).buffer : msg
    if (this.ws.readyState === 1) {
      this.ws.send(data)
    } else {
      this.sendQueue.push(msg)
    }
  }
  on (reqEvent, fn) {
    const listener = e => fn(getMsg(e))
    this.ws.addEventListener(reqEvent, listener)
    return listener
  }
  off (reqEvent, listener) {
    this.ws.removeEventListener(reqEvent, listener)
  }
}

export default WS
