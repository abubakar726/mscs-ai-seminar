const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy HTTP API requests
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
    })
  );

  // Proxy WebSocket connections for Socket.io
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      ws: true,
      changeOrigin: true,
    })
  );
};
