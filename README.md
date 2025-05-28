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
- [x] Transforms

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

## Transforms
Sometimes, messages can contain further serialized data, such as stringified `BigInt`s. You can
attach transforms to both messages and individual fields to pull further parsing and validation into
the transmission pipeline:

```ts
import { hpb, type TransformParameters } from '@kiruse/hiproto';

class Foo {
  constructor(
    public amount: bigint,
    public denom: string,
  ) {}

  toString() {
    `${amount} $${denom}`;
  }
}

// You don't have to pull the params out, but it allows reusing it
const bigintTransform: TransformParameters<string, bigint> = {
  encode: (value: bigint) => value.toString(),
  decode: (value: string) => BigInt(value),
  default: 0n,
};

const schema = hpb.message({
  denom: hpb.string(1),
  amount: hpb.string(2).transform(bigintTransform),
})
.transform<Foo>({
  encode: ({ amount, denom }: Foo) => ({ amount, denom }),
  decode: ({ amount, denom }) => new Foo(amount ?? 0n, denom ?? 'usd'),
  get default() { return new Foo(0n, 'usd') },
});

const bytes = schema.encode(new Foo(100n, 'usd'));
bytes.seek(0);

const decoded = schema.decode(bytes);
console.log(decoded instanceof Foo, decoded.toString());
```

## Required Fields
Protobuf itself has no concept of required fields. Any field that has its default value will be
omitted from the wire data for extra compression. This is reflected in *hiproto* with fields
generally being optional on the decoded messages.

However, you can mark a field as `required()` to instruct *hiproto* to always populate the field
with the default value if otherwise not present. Required fields will also be non-optional keys in
the inferred message type to enforce intentionality of "omitted" types, i.e. you will need to
explicitly supply the default value.

The following snippet should illustrate its usage:

```ts
import hpb from '@kiruse/hiproto';

const schema = hpb.message({
  name: hpb.string(1),
  bytes: hpb.bytes(2).required(),
  vector: hpb.repeated.float(3).required(),
});

const foo: hpb.infer<typeof schema> = {
  name: '',
  bytes: new Uint8Array(),
  vector: [1, 2, 3],
};

const encoded1 = schema.encode(foo).toShrunk().seek(0);
const decoded1 = schema.decode(encoded1);

console.log(decoded1.name); // undefined
console.log(decoded1.bytes); // Uint8Array []
console.log(decoded1.vector); // [1, 2, 3]

const encoded2 = hpb.message({}).encode({}).toShrunk().seek(0);
const decoded2 = schema.decode(encoded2);

console.log(decoded2.name); // undefined
console.log(decoded2.bytes); // Uint8Array []
console.log(decoded2.vector); // []
```

## JSON Codec
There exists a special, non-standard yet useful schema to encode arbitrary data as a JSON-encoded
string. This codec is simply an extension of the `string` codec, which in turn is an extension of
the `bytes` codec. This codec was introduced as an example for a non-standard codec, but also for a
special use case of my own.

```ts
import hpb from '@kiruse/hiproto';

const schema = hpb.message({
  name: hpb.string(1),
  flag: hpb.boolean(2),
  scale: hpb.float(3),
  extra: hpb.json(4, 'raw'),
});

const encoded = schema.encode({
  name: 'hello, world!',
  flag: true,
  scale: 1.2,
  extra: {
    foo: 123,
    bar: 'baz',
  },
}).toShrunk().seek(0);

console.log(schema.decode(encoded));
```

## Low-Level Caveat
Due to how protobuf `repeated` works, codecs themselves do not actually handle arrays. `repeated`
only makes sense in the context of containing messages. Thus, the following snippet will not deliver
the expected result:

```ts
import hpb from '@kiruse/hiproto';

const val = hpb.repeated.uint32(1);
console.log(val.length([1, 2, 3])); // will throw b/c array is not supported by underlying codec
```

As protobuf is only really concerned with full messages, you should always operate on messages, not
individual fields. The following snippet will work as intended:

```ts
import hpb from '@kiruse/hiproto';

const val = hpb.message({
  values: hpb.repeated.uint32(1),
});
console.log(val.length({ values: [1, 2, 3] }));
```
