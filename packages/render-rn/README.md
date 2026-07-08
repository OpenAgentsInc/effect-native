# @effect-native/render-rn

React Native renderer package for Effect Native.

This package is the only workspace package allowed to speak React Native. It
will map Effect Native view trees to React Native host components while
keeping app code authored against the typed Effect Native contract. Issue #1
only creates the package shell; renderer behavior lands in issue #7.

```ts
import { packageName } from "@effect-native/render-rn"

console.log(packageName)
```

