# Websocket Sequence

## Usage

```javascript
import WS from 'ws-sequence'

const ws = new WS({uri: 'wss://localhost', ping: '💧', binaryType: 'blob'})

ws.on('open', e => {
  console.log(e)
})
ws.on('message', msg => {
  console.log(msg)
})
ws.send({foo: 'bar'})
```
