import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { DevtoolsEventSchema } from "@effect-native/core"
import { Schema } from "effect"
import WebSocket, { WebSocketServer } from "ws"
import { makeRecordingSink, serializeRecording } from "./index"

export interface DevtoolsServerOptions {
  readonly port?: number
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Effect Native DevTools</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button { font: inherit; }
      [data-effect-native-surface="dom"] { min-height: 100vh; }
    </style>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/panel.js"></script>
  </body>
</html>`

const panelUrl = new URL("../public/panel.js", import.meta.url)

export const startDevtoolsServer = async (options: DevtoolsServerOptions = {}) => {
  const requestedPort = options.port ?? Number(process.env.PORT ?? 4327)
  const recording = makeRecordingSink(null)
  const clients = new Set<WebSocket>()
  const websocketServer = new WebSocketServer({ noServer: true })

  const broadcast = () => {
    const message = JSON.stringify({
      type: "devtools:recording",
      recording: JSON.parse(serializeRecording(recording.recording()))
    })
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message)
    }
  }

  websocketServer.on("connection", (socket) => {
    clients.add(socket)
    broadcast()
    socket.on("close", () => clients.delete(socket))
    socket.on("message", (rawMessage) => {
      const payload = JSON.parse(String(rawMessage)) as {
        readonly type?: string
        readonly event?: unknown
      }
      if (payload.type === "devtools:event") {
        recording.sink.emit(Schema.decodeUnknownSync(DevtoolsEventSchema)(payload.event))
        broadcast()
      } else if (payload.type === "devtools:hello") {
        broadcast()
      }
    })
  })

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/panel.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" })
      response.end(await readFile(panelUrl))
      return
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(html)
  })

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname !== "/session") {
      socket.destroy()
      return
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request)
    })
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(requestedPort, "127.0.0.1", resolveListen)
  })
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("devtools server did not bind a TCP port")
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    recording: recording.recording,
    stop: () =>
      new Promise<void>((resolveClose, reject) => {
        for (const client of clients) client.close()
        websocketServer.close()
        server.closeAllConnections()
        server.close((error) => (error === undefined ? resolveClose() : reject(error)))
      })
  }
}

const isDirectEntry = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectEntry) {
  const server = await startDevtoolsServer()
  console.log(`Effect Native DevTools: ${server.url}`)
}
