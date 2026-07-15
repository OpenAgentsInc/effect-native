import { Effect } from "effect"
import { khalaTheme, resolveKhalaMotif } from "../../packages/tokens/src/index"

const result = Effect.runSync(
  resolveKhalaMotif(
    {
      motif: "cut-corner-surface",
      width: 320,
      height: 120,
      zoom: 2,
      density: "comfortable",
      forcedColors: true
    },
    khalaTheme.khalaUi
  )
)

process.stdout.write(JSON.stringify(result))
