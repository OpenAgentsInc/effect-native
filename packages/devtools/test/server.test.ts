import { describe, expect, test } from "vite-plus/test"
import WebSocket from "ws"
import { startDevtoolsServer } from "../src/server"

describe("Node DevTools server", () => {
  test("serves the panel shell and broadcasts an empty recording", async () => {
    const server = await startDevtoolsServer({ port: 0 })
    try {
      const shell = await fetch(server.url)
      expect(shell.status).toBe(200)
      expect(await shell.text()).toContain("Effect Native DevTools")

      const message = await new Promise<string>((resolveMessage, reject) => {
        const socket = new WebSocket(`${server.url.replace("http", "ws")}/session`)
        socket.once("error", reject)
        socket.once("message", (value) => {
          resolveMessage(String(value))
          socket.close()
        })
      })
      expect(JSON.parse(message)).toMatchObject({
        type: "devtools:recording",
        recording: { timeline: [] }
      })
    } finally {
      await server.stop()
    }
  })
})
