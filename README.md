# hiproto
I work in an ecosystem with many modular protobuf declarations scattered across a variety of
repositories. Lack of a common standard makes collecting & compiling these files nigh impossible.
At the same time, often I do not need the entire collection of protobuf types. Thus, *hiproto* was
born to make it easier to define protobufs in code, rather than generating the types & en/decoders.

*hiproto* accomplishes this by taking the same approach as [zod](https://github.com/colinhacks/zod):
Define a message through TypeScript-compatible schema validators, the type of which can be `infer`red.

## Setup
Install the library with your favorite package manager's equivalent of:

```bash
npm install @kiruse/hiproto
```

## Example
```ts
import { hpb } from '@kiruse/hiproto';

const schema = hpb.message({
  foo: hpb.fixed32(1),
  bar: hpb.string(2),
  baz: hpb.submessage(4, {
    foo: hpb.bool(1),
    bar: hpb.varint(2),
  }),
});

type MyMessage = hpb.infer<typeof myTypeSchema>;
type MySubmessage = MyMessage['baz'];

const encoded = schema.encode({
  foo: 42,
  bar: 'foobar',
  baz: {
    foo: true,
    bar: 43,
  },
});

encoded.seek(0);

console.log(encoded.toHex(), encoded.bytes().toUint8Array());
console.log(schema.decode(encoded));
```

*hiproto* more or less mirrors the protobuf language married with zod.

## Features
Following wire format features have been implemented, or will be implemented in the future:

- [x] Varint
- [x] Scalars
- [x] Submessages
- [x] Bytes & Strings
- [x] Open enums
- [ ] Full enums
- [x] `repeated`, packed
- [x] `repeated`, extended
- [ ] *One of*'s
- [ ] *Last one wins*
- [ ] Maps
- [ ] Groups
- [x] Unknown fields
- [x] `hpb.infer`

**Note** that *Groups* are deprecated, and thus do not enjoy high priority in this project.

## Enums
Enums are subject to some special requirements in protobuf:

- Although TypeScript supports string-based enums, protobuf enums are always numeric.
- Enums should always have a 0 value, and it should mean something like "unknown." This is because
  **all fields are optional by default** in protobuf, and all scalars have the default value of 0.

Note that enums are currently not fully [standard-compliant](https://protobuf.dev/programming-guides/enum/).
This is actually true for many implementations across various languages. *protobuf* distinguishes
between *open* and *closed* enums, with *closed* enums allowing only the specified values of an enum.

**This library currently only supports *open* enums.**

Since the behavior of enums changes depending on how it's been imported and where -with respect to
the *proto2* or *proto3* syntaxes- this technically requires the capacity to strictly define how our
enum shall be de/encoded. This feature will be added in a future release.

## Unknown Fields
Unknown fields are preserved on your decoded object using the `UnknownFields` symbol:

```ts
import { hpb, UnknownFields } from '@kiruse/hiproto';

const schema1 = hpb.message({
  flag: hpb.bool(1),
  name: hpb.string(2),
});

const schema2 = hpb.message({
  name: hpb.string(2),
});

const encoded = schema1.encode({
  flag: true,
  name: 'foobar',
}).seek(0);

const decoded = schema2.decode(encoded);
console.log(decoded[UnknownFields]);
```

Unknown fields are preserved when re-encoding the object. However, the raw wire data order is
unstable and you may receive a different payload than you originally parsed. *protobuf* defines a
deterministic format, but not a canonical format. Thus, you should refrain from using the wire data
or derived data such as hashes as indexes.
