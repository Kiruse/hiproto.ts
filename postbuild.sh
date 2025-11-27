#!/bin/bash

# Replace Uint8Array<ArrayBufferLike> with Uint8Array in all .d.ts files in ./dist
# Different versions of TypeScript with different libs may define `Uint8Array` differently.
# Some environments don't have a generic `Uint8Array` type at all, but those that do have it will
# typically have a default type for it. So, we remove the generic type to ensure compatibility.
find ./dist -name "*.d.ts" -type f -exec sed -i 's/Uint8Array<ArrayBufferLike>/Uint8Array/g' {} \;

echo "Postbuild: Replaced Uint8Array<ArrayBufferLike> with Uint8Array in all .d.ts files"
