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
- [ ] Scalars
- [ ] Submessages
- [ ] Bytes & Strings
- [ ] `optional`
- [ ] `repeated`, packed
- [ ] `repeated`, extended
- [ ] *One of*'s
- [ ] *Last one wins*
- [ ] Maps
