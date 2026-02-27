/**
 * Custom Next.js Server with WebSocket Support
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * Runs Next.js with Socket.io for real-time notifications
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize WebSocket server
  // Note: We import this dynamically to avoid issues with TypeScript during build
  import("./lib/websocket-server.js")
    .then(({ initializeWebSocketServer }) => {
      initializeWebSocketServer(httpServer);
      console.log("✅ WebSocket server initialized");
    })
    .catch((err) => {
      console.error("Failed to initialize WebSocket server:", err);
    });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server ready on http://${hostname}:${port} with WebSocket support`
      );
    });
});
