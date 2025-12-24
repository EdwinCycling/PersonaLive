import { Context } from "netlify:edge";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  
  // Log for debugging
  console.log(`Proxy request to: ${url.pathname}`);

  // Only handle WebSocket upgrades or specific paths related to the Live API
  // The SDK might also make some HTTP calls to the same base URL, so we should proxy those too if needed.
  // But for now, focus on the WebSocket.
  
  // Construct the target URL
  // The SDK appends the path to the base URL.
  // We want to target generativelanguage.googleapis.com
  const targetUrl = new URL(request.url);
  targetUrl.protocol = "https:"; // Default to https, upgrade to wss if needed
  targetUrl.host = "generativelanguage.googleapis.com";
  targetUrl.port = "";

  const prefix = "/api/gemini-proxy";
  if (targetUrl.pathname.startsWith(prefix)) {
    const stripped = targetUrl.pathname.slice(prefix.length);
    targetUrl.pathname = stripped.length > 0 ? stripped : "/";
  }
  
  // The SDK might append /ws/... or /v1beta/...
  // We keep the pathname as is.

  // Replace the API Key
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in environment variables");
    return new Response("Internal Server Error: Missing API Key", { status: 500 });
  }

  const params = targetUrl.searchParams;
  // Remove client-provided dummy key if present
  if (params.has("key")) {
    params.delete("key");
  }
  // Add server-side key
  params.set("key", apiKey);

  // Handle WebSocket Upgrade
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    targetUrl.protocol = "wss:";
    console.log(`Proxying WebSocket to: ${targetUrl.toString().replace(apiKey, 'HIDDEN')}`);
    
    try {
      // Connect to the upstream Gemini WebSocket
      const geminiSocket = new WebSocket(targetUrl.toString());
      
      // Accept the client connection
      const { socket: clientSocket, response } = Deno.upgradeWebSocket(request);

      // Buffer messages until upstream is open
      const messageQueue: any[] = [];
      let isGeminiOpen = false;

      geminiSocket.onopen = () => {
        isGeminiOpen = true;
        console.log("Connected to Gemini");
        // Flush queue
        while (messageQueue.length > 0) {
          geminiSocket.send(messageQueue.shift());
        }
      };

      geminiSocket.onmessage = (event) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      geminiSocket.onclose = (event) => {
        console.log("Gemini closed connection", event.code, event.reason);
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.close(event.code, event.reason);
        }
      };

      geminiSocket.onerror = (error) => {
        console.error("Gemini WebSocket error:", error);
        // Usually handled by onclose
      };

      // Handle Client messages
      clientSocket.onmessage = (event) => {
        if (isGeminiOpen) {
          geminiSocket.send(event.data);
        } else {
          messageQueue.push(event.data);
        }
      };

      clientSocket.onclose = (event) => {
        console.log("Client closed connection");
        if (geminiSocket.readyState === WebSocket.OPEN) {
          geminiSocket.close(event.code, event.reason);
        }
      };

      return response;
    } catch (e) {
      console.error("WebSocket Proxy Error:", e);
      return new Response("WebSocket Proxy Error", { status: 502 });
    }
  }

  // Handle standard HTTP requests (if any)
  // This is useful if the SDK makes non-websocket calls to the same base URL
  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    return response;
  } catch (e) {
    console.error("HTTP Proxy Error:", e);
    return new Response("HTTP Proxy Error", { status: 502 });
  }
};

export const config = { path: "/api/gemini-proxy/*" };
