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

const mySubMessage = hpb.message({
  foo: hpb.bool(1),
  bar: hpb.varint(2),
});

const myTypeSchema = hpb.message({
  foo: hpb.fixed32(1),
  bar: hpb.string(2),
  baz: hpb.message(4, mySubMessage),
});

type MyType = hpb.infer<typeof myTypeSchema>;

const bytes = await loadPayload();

const instance: MyType = myTypeSchema.parse(bytes);
```

*hiproto* more or less mirrors the protobuf language married with zod.

## Features
Following wire format features have been implemented, or will be implemented in the future:

- [x] Varint
- [x] Scalars
- [ ] Submessages
- [ ] Bytes & Strings
- [x] Open enums
- [ ] Full enums
- [ ] `repeated`, packed
- [ ] `repeated`, extended
- [ ] *One of*'s
- [ ] *Last one wins*
- [ ] Maps
- [ ] Groups

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
