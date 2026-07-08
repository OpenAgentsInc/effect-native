# @effect-native/render-dom

DOM renderer package for Effect Native.

This package will lower Effect Native view trees to direct DOM output. It is
intentionally React-free. Issue #1 only creates the package shell; renderer
behavior lands in issue #6.

```ts
import { packageName } from "@effect-native/render-dom"

console.log(packageName)
```

