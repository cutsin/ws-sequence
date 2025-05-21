import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WS from './index'; // Adjust path as necessary
import ReconnectingWebSocketConstructor from 'reconnecting-websocket'; // Import the mock

// Mock ReconnectingWebSocket
// Global store for ReconnectingWebSocket mock instances by URI for test inspection
const rwsMocksByURI = {};

vi.mock('reconnecting-websocket', () => {
  const createMockRWSInstance = (uri) => {
    const mock = {
      uri: uri,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 0, // initial: CONNECTING
      binaryType: 'blob', // default
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    };
    rwsMocksByURI[uri] = mock; // Store mock for retrieval in tests if needed
    return mock;
  };
  return {
    default: vi.fn().mockImplementation(createMockRWSInstance),
    // __esModule: true, // if your actual module uses ES modules
  };
});

// Helper to clear the global ConnectedSockets cache in WS module by re-importing or other means if possible
// For now, we rely on unique URIs per test or manual reset if WS class offered it.
// Since WS is imported once, ConnectedSockets is shared. Using unique URIs is key.
const getGlobalConnectedSockets = () => {
  // This is a placeholder; direct access to module internals like ConnectedSockets
  // from a test file is generally not straightforward or clean.
  // If WS.js exported ConnectedSockets or a reset function, we'd use that.
  // For this test, we assume unique URIs will bypass issues with ConnectedSockets.
  // console.log("Warning: ConnectedSockets cannot be directly cleared by tests without module cooperation.");
  return null; // Placeholder
}

describe('WS Class', () => {
  let mainWsInstance;
  let mainRwsMock;
  const mainUri = 'ws://localhost/main';

  beforeEach(() => {
    vi.clearAllMocks(); // Clears call history, etc. for all mocks

    // Critical: Reset the ReconnectingWebSocket constructor mock's history of calls AND instances
    // ReconnectingWebSocket.mockClear(); // This is done by vi.clearAllMocks() if ReconnectingWebSocket is default export mock
    
    // Clear the storage of mocks if persisting (rwsMocksByURI is test-local, cleared implicitly or explicitly if needed)
    for (const key in rwsMocksByURI) delete rwsMocksByURI[key];

    // Attempt to reset ConnectedSockets if it were possible (it's not directly without module change)
    // For now, ensure each 'describe' block or critical test uses unique URIs if creating WS instances.
    // The 'mainWsInstance' uses 'mainUri'. Other tests should use different URIs.
    // This avoids WS instances reusing underlying RWS objects from a previous test's ConnectedSockets cache.

    mainWsInstance = new WS({ uri: mainUri });
    mainRwsMock = mainWsInstance.ws; // Get the mock associated with this specific instance

    // Simulate 'open' for this main instance, as many tests might assume an open connection
    mainRwsMock.readyState = 1; // Simulate ReconnectingWebSocket.OPEN
    const openCallback = mainRwsMock.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
    if (openCallback) {
      openCallback(); // Trigger the 'open' handler in WS.js
    }
    mainRwsMock.send.mockClear(); // Clear send calls from this initial open/ping
  });

  afterEach(() => {
    vi.useRealTimers(); // Reset timers after each test
    if (mainWsInstance && mainWsInstance.keeper) {
      clearTimeout(mainWsInstance.keeper); // Clean up any running timers in WS instance
    }
    // Any other WS instances created in tests also need similar cleanup if they have timers
  });

  describe('Connection & Basic Send/Receive', () => {
    it('should create a WS instance and a ReconnectingWebSocket with the given URI', () => {
      expect(mainWsInstance).toBeInstanceOf(WS);
      expect(mainWsInstance.ws).toBeDefined();
      // Check if ReconnectingWebSocket constructor was called with the URI
      expect(ReconnectingWebSocketConstructor).toHaveBeenCalledWith(mainUri, [], undefined);
      expect(mainRwsMock.uri).toBe(mainUri); // Check if our mock factory passed it
    });

    it('should send a message when WebSocket is open', () => {
      const message = { type: 'test', payload: 'hello' };
      mainWsInstance.send(message);
      const expectedMsgId = mainWsInstance.id - 1;
      expect(mainRwsMock.send).toHaveBeenCalledWith(JSON.stringify({ ...message, id: expectedMsgId }));
    });

    it('should queue a message if WebSocket is not open and send when opened', () => {
      const queuedUri = 'ws://localhost/queued';
      // Create a new WS instance with a unique URI to ensure it gets a fresh RWS mock
      // and doesn't hit ConnectedSockets cache from other tests.
      const queuedWsInstance = new WS({ uri: queuedUri });
      const queuedRwsMock = queuedWsInstance.ws; // Specific mock for this instance
      
      queuedRwsMock.readyState = 0; // Explicitly set to not open

      const message = { type: 'queued', payload: 'test' };
      queuedWsInstance.send(message);
      expect(queuedRwsMock.send).not.toHaveBeenCalled();

      // Simulate open event for this specific instance
      queuedRwsMock.readyState = 1;
      const openCallback = queuedRwsMock.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) {
        openCallback(); // This should trigger queuedWsInstance's open handler
      }
      const expectedMsgId = queuedWsInstance.id - 1;
      expect(queuedRwsMock.send).toHaveBeenCalledWith(JSON.stringify({ ...message, id: expectedMsgId }));
    });

    it('should trigger generic message event via WS instance .on() method', () => {
      const handler = vi.fn();
      // Listen on the mainWsInstance
      mainWsInstance.on('message', handler);

      // Simulate a server message arriving on its underlying mock websocket
      const serverMessage = { data: JSON.stringify({ type: 'server_event', content: 'data' }) };
      
      // Find the message event listener *on the mock RWS object* that was added by mainWsInstance.on()
      // The addEventListener mock calls array on mainRwsMock will contain [event, callback]
      // The callback is wrapped by WS.on to include getMsg logic.
      const onMessageListener = mainRwsMock.addEventListener.mock.calls.find(call => call[0] === 'message' && call[1].name.includes('listener'))?.[1];

      expect(onMessageListener).toBeDefined();
      if (onMessageListener) {
        onMessageListener(serverMessage); // Directly invoke the listener with mock event
      }
      expect(handler).toHaveBeenCalledWith({ type: 'server_event', content: 'data' });
    });
  });

  describe('Callback Mechanism', () => {
    it('should invoke callback on server response with matching ID', () => {
      const callback = vi.fn();
      const message = { action: 'get_data' };
      // ID will be mainWsInstance.id before it's incremented
      const messageId = mainWsInstance.id; 
      mainWsInstance.send(message, callback);

      expect(mainRwsMock.send).toHaveBeenCalledWith(JSON.stringify({ ...message, id: messageId }));

      // Simulate server response
      const serverResponse = { data: JSON.stringify({ id: messageId, result: 'data_response' }) };
      // Find the message listener on the RWS mock (this is the one set up in WS constructor)
      const constructorMessageListener = mainRwsMock.addEventListener.mock.calls.find(call => {
          return call[0] === 'message' && call[1].toString().includes('this.callbacks.get(msg.id)');
      })?.[1];
      
      expect(constructorMessageListener).toBeDefined();
      if (constructorMessageListener) {
        constructorMessageListener(serverResponse);
      }

      expect(callback).toHaveBeenCalledWith('data_response');
      expect(mainWsInstance.callbacks.has(messageId)).toBe(false);
    });

     it('should remove callback after invocation', () => {
      const callback = vi.fn();
      const message = { task: 'perform_action' };
      const messageId = mainWsInstance.id;
      mainWsInstance.send(message, callback);

      const serverResponse = { data: JSON.stringify({ id: messageId, result: 'action_complete' }) };
      const constructorMessageListener = mainRwsMock.addEventListener.mock.calls.find(call => call[0] === 'message' && call[1].toString().includes('this.callbacks.get(msg.id)'))?.[1];
      if (constructorMessageListener) {
        constructorMessageListener(serverResponse);
      }
      
      expect(mainWsInstance.callbacks.has(messageId)).toBe(false);
    });
  });

  describe('Keep-Alive Ping', () => {
    it('should send a ping frame after the keep-alive interval', () => {
      vi.useFakeTimers();
      const pingUri = 'ws://localhost/ping';
      const customPingMessage = 'ping_test_frame';
      const pingWsInstance = new WS({ uri: pingUri, ping: customPingMessage });
      const pingRwsMock = pingWsInstance.ws;
      
      pingRwsMock.readyState = 1; // Set to open
      const openCallback = pingRwsMock.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) {
          openCallback(); // This starts the keeping() timer
      }
      pingRwsMock.send.mockClear(); // Clear send from open
      
      expect(pingRwsMock.send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(55000);
      expect(pingRwsMock.send).toHaveBeenCalledWith(customPingMessage);
      
      vi.advanceTimersByTime(55000);
      expect(pingRwsMock.send).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
      clearTimeout(pingWsInstance.keeper);
    });
  });

  describe('Binary Data Configuration', () => {
    it('should default to "blob" if TextEncoder is not defined globally for WS constructor context', () => {
      const originalTextEncoder = global.TextEncoder;
      global.TextEncoder = undefined; // Simulate TextEncoder not being available

      const binaryTestUri1 = 'ws://localhost/binary1';
      const wsInstanceNoEncoder = new WS({ uri: binaryTestUri1 });
      // The WS constructor logic: if (typeof TextEncoder === 'undefined') binaryType = 'blob'
      // This happens before RWS mock is even involved.
      expect(wsInstanceNoEncoder.binaryType).toBe('blob');

      global.TextEncoder = originalTextEncoder; // Restore
    });

    it('should use specified binaryType if TextEncoder is available', () => {
      const binaryTestUri2 = 'ws://localhost/binary2';
      // TextEncoder is available in jsdom by default
      const wsInstanceWithBT = new WS({ uri: binaryTestUri2, binaryType: 'arraybuffer' });
      expect(wsInstanceWithBT.binaryType).toBe('arraybuffer');
    });
    
    it('should set ws.binaryType (on the mock RWS) to the instance binaryType on open', () => {
      const binaryTestUri3 = 'ws://localhost/binary3';
      const wsInstanceForMockBT = new WS({ uri: binaryTestUri3, binaryType: 'arraybuffer' });
      const rwsMockForBT = wsInstanceForMockBT.ws;
      
      rwsMockForBT.readyState = 1; // Set to open
      const openCallback = rwsMockForBT.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) {
        openCallback(); // Triggers this.ws.binaryType = this.binaryType;
      }
      expect(rwsMockForBT.binaryType).toBe('arraybuffer');
    });

    it('should send data as ArrayBuffer when binaryType is "arraybuffer"', () => {
      const binaryTestUri4 = 'ws://localhost/binary4';
      const wsInstanceArrayBuffer = new WS({ uri: binaryTestUri4, binaryType: 'arraybuffer' });
      const rwsMockArrayBuffer = wsInstanceArrayBuffer.ws;

      rwsMockArrayBuffer.readyState = 1; // Open state
      const openCallback = rwsMockArrayBuffer.addEventListener.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) { openCallback(); }
      rwsMockArrayBuffer.send.mockClear(); // Clear any sends from open (like pings if timers advanced)


      const message = { data: 'binary test' };
      wsInstanceArrayBuffer.send(message);
      const expectedMsgId = wsInstanceArrayBuffer.id - 1;

      expect(rwsMockArrayBuffer.send).toHaveBeenCalledTimes(1);
      const sentData = rwsMockArrayBuffer.send.mock.calls[0][0];
      expect(sentData).toBeInstanceOf(ArrayBuffer);
      
      // Verify content if TextDecoder is available (it is in jsdom)
      expect(new TextDecoder().decode(sentData)).toBe(JSON.stringify({...message, id: expectedMsgId}));
    });
  });
});
