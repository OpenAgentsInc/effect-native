import { Schema } from "effect"
import { DevtoolsEventSchema } from "@effect-native/core"
import {
  makeRecordingSink,
  serializeRecording
} from "./index"

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

const panelFile = () => Bun.file(new URL("../public/panel.js", import.meta.url))

export const startDevtoolsServer = (options: DevtoolsServerOptions = {}) => {
  const port = options.port ?? Number(Bun.env.PORT ?? 4327)
  const recording = makeRecordingSink(null)
  const clients = new Set<Bun.ServerWebSocket<unknown>>()

  const broadcast = () => {
    const message = JSON.stringify({
      type: "devtools:recording",
      recording: JSON.parse(serializeRecording(recording.recording()))
    })
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    }
  }

  const server = Bun.serve({
    port,
    fetch: (request, server) => {
      const url = new URL(request.url)
      if (url.pathname === "/session" && server.upgrade(request)) {
        return undefined
      }
      if (url.pathname === "/panel.js") {
        return new Response(panelFile(), {
          headers: { "content-type": "text/javascript; charset=utf-8" }
        })
      }
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" }
      })
    },
    websocket: {
      open: (socket) => {
        clients.add(socket)
        broadcast()
      },
      close: (socket) => {
        clients.delete(socket)
      },
      message: (_socket, rawMessage) => {
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
      }
    }
  })

  return {
    url: `http://localhost:${port}`,
    recording: recording.recording,
    stop: () => server.stop()
  }
}

if (import.meta.main) {
  const server = startDevtoolsServer()
  console.log(`Effect Native DevTools: ${server.url}`)
}
