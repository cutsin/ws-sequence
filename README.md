# Websocket Sequence (ws-sequence)

`ws-sequence` is a JavaScript library for managing WebSocket connections with support for message sequencing, automatic reconnection, and keep-alive pings. This project has recently been modernized to use up-to-date dependencies and development practices.

## Features

*   Automatic reconnection if the WebSocket connection is lost.
*   Message sequencing with callbacks: send a message and get a callback when the corresponding response arrives.
*   Keep-alive pings to prevent idle disconnections.
*   Configurable binary type (`blob` or `arraybuffer`).
*   Lightweight and simple to use.

## Project Modernization

This project has undergone significant updates to align with modern JavaScript development standards:

*   **Updated Core Dependencies**: Core build tools and dependencies, including Rollup and Babel, have been updated to their latest stable versions.
*   **Modern JavaScript Targets**: The library now targets modern browsers. Support for older browsers like IE11 has been dropped to leverage newer JavaScript features and reduce bundle size. The `browserslist` configuration is `> 0.2%, not dead, not op_mini all`.
*   **Automated Test Suite**: A comprehensive test suite has been implemented using Vitest, ensuring code reliability and maintainability.
*   **Modern Build Tooling Compatibility**: The project setup is compatible with current JavaScript build systems and module formats.

## Installation

You can install `ws-sequence` using npm:

```bash
npm install ws-sequence
```

## Usage

`ws-sequence` can be imported into your project using ES Module syntax.

```javascript
import WS from 'ws-sequence';

// Initialize with the WebSocket URI
// Optional parameters:
// - ping: Custom ping message/frame (default: '💧')
// - binaryType: 'blob' (default) or 'arraybuffer'
// - options: Options object passed directly to the ReconnectingWebSocket constructor
const ws = new WS({
  uri: 'wss://your-websocket-server.com',
  ping: 'keepalive!', // Optional custom ping message
  binaryType: 'arraybuffer' // Optional: 'blob' or 'arraybuffer'
});

// Listen for the 'open' event (connection established)
ws.on('open', (event) => {
  console.log('WebSocket connection opened:', event);
  // Send a message once connected
  ws.send({ greeting: 'Hello Server!' }, (response) => {
    console.log('Server responded to greeting:', response);
  });
});

// Listen for incoming messages from the server
ws.on('message', (message) => {
  console.log('Received message from server:', message);
  // Example: if server sends { event: 'user_joined', user: 'Alice' }
  if (message.event === 'user_joined') {
    console.log(message.user, 'joined the chat.');
  }
});

// Listen for the 'close' event
ws.on('close', (event) => {
  console.log('WebSocket connection closed:', event);
});

// Listen for the 'error' event
ws.on('error', (event) => {
  console.error('WebSocket error:', event);
});

// Send a message (object or string)
// The second argument is an optional callback that will be invoked
// when a response with a matching ID is received.
ws.send({ action: 'getData', params: { id: 123 } }, (response) => {
  console.log('Response to getData:', response);
});

// Send a simple string message (no callback for this type)
ws.send('Just a string message');
```

### Bundle Formats

The library is distributed with the following bundle formats in the `dist/` directory:

*   **ES Module (ESM)**: `dist/wseq.mjs` - For use with modern bundlers like Webpack, Rollup, or Parcel, and in browsers that support ES modules.
*   **CommonJS (CJS)**: `dist/wseq-cjs.js` - For use in Node.js environments or with older bundlers.

Your bundler should automatically pick the appropriate format (usually ESM if available).

## Development

To contribute to `ws-sequence` or run it locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/cutsin/ws-sequence.git
    cd ws-sequence
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the project**:
    This command bundles the library into the `dist` directory.
    ```bash
    npm run build
    ```

4.  **Run tests**:
    This command executes the test suite using Vitest.
    ```bash
    npm test
    ```

## License

MIT License. See the LICENSE file for details (though a LICENSE file was not present in the provided repository structure).
