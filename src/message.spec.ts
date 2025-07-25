import { describe, expect, test } from 'bun:test';
import { v } from './schema';
import { Bytes, ProtoBuffer } from './protobuffer';
import { IMessage } from './message';

describe('messages', () => {
  test('default values', () => {
    const schema = v.message({
      flag: v.bool(1),
      count: v.int32(2),
      values: v.repeated.int32(3),
    });

    let buffer = new ProtoBuffer(new Uint8Array(0));
    expect(schema.decode(buffer)).toMatchObject({
      flag: false,
      count: 0,
      values: [],
    });
  });

  test('empty wire data', () => {
    const schema = v.message({
      flag: v.bool(1),
      count: v.int32(2),
      values: v.repeated.int32(3),
    });

    let buffer = new ProtoBuffer(new Uint8Array(0));
    schema.encode({}, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(0);
    expect(schema.decode(buffer)).toMatchObject({
      flag: false,
      count: 0,
      values: [],
    });
  });

  test('packed fields', () => {
    const schema = v.message({
      values: v.repeated.int32(1),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({ values: [1, 2, 3] }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();

    expect(buffer.writtenLength).toBe(5);
    expect(schema.decode(buffer)).toMatchObject({ values: [1, 2, 3] });
  });

  test('missing fields', () => {
    const schema = v.message({
      flag: v.bool(1),
      count: v.int32(2),
      values: v.repeated.int32(3),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      flag: true, // 2 bytes (header + value)
      values: [1, 2, 3], // 5 bytes (header + len + 3 bytes)
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();
    expect(buffer.writtenLength).toBe(7);
    expect(schema.decode(buffer)).toMatchObject({
      flag: true,
      count: 0,
      values: [1, 2, 3],
    });
  });

  test('messages', () => {
    enum MessageType {
      Unknown = 0,
      Text = 1,
      Image = 2,
    };

    const schema = v.message({
      name: v.string(1),
      type: v.enum<MessageType>(2),
      payload: v.bytes(3).required(),
      memo: v.string(4),
      flags: v.repeated.bool(5),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      name: 'hello', // 7 bytes (header + len + 5 bytes)
      type: MessageType.Unknown, // 0 bytes (default values are dropped)
      payload: new Uint8Array([1, 2, 3]), // 5 bytes (header + len + 3 bytes)
      flags: [true, false, true], // 5 bytes (header + len + 3 bytes)
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();

    let decoded = schema.decode(buffer);

    expect(buffer.writtenLength).toBe(17);
    expect(decoded).toMatchObject({
      name: 'hello',
      type: MessageType.Unknown,
      memo: '',
      flags: [true, false, true],
    });
    expect(Bytes.getUint8Array(decoded.payload!)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('submessage', () => {
    const schema = v.message({
      name: v.string(1),
      sub1: v.submessage(2, {
        value: v.int32(1),
      }),
      sub2: v.submessage(3, {
        value: v.int32(2),
      }),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      name: 'hello', // 7 bytes (header + len + 5 bytes)
      sub1: { // 4 bytes (header + len + content)
        value: 42, // 2 bytes (header + value)
      },
      sub2: { // 4 bytes, same as above
        value: 43,
      },
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk(); // TODO: it's correctly encoding, but decoding runs into a buffer underflow

    expect(buffer.writtenLength).toBe(15);
    expect(schema.decode(buffer)).toMatchObject({
      name: 'hello',
      sub1: {
        value: 42,
      },
      sub2: {
        value: 43,
      },
    });
  });

  test('repeated submessage', () => {
    const schema = v.message({
      name: v.string(1),
      submessages: v.repeated.submessage(2, { value: v.int32(1) }),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      name: 'hello', // 7 bytes (header + len + 5 bytes)
      // note that expanded items don't have additional overhead as they're just written as individual
      // items, not as a group
      submessages: [ // 8 bytes (items * 2)
        { value: 42 }, // 4 bytes (header + len + content (header + 1 byte))
        { value: 43 }, // 4 bytes, same as above
      ],
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();

    expect(buffer.writtenLength).toBe(15);
    expect(schema.decode(buffer)).toMatchObject({
      name: 'hello',
      submessages: [{ value: 42 }, { value: 43 }],
    });
  });

  test('transform', () => {
    // Define a message schema with various field types
    const schema = v.message({
      id: v.int32(1),
      name: v.string(2),
      score: v.float(3),
    }).transform<{
      id: number;
      name: string;
      score: number;
    }>({
      encode: (value) => ({
        id: value.id ?? 0,
        name: (value.name ?? '').toUpperCase(),
        score: (value.score ?? 0) * 100,
      }),
      decode: (value) => ({
        id: value.id ?? 0,
        name: (value.name ?? '').toLowerCase(),
        score: (value.score ?? 0) / 100,
      }),
      default: {
        id: 0,
        name: '',
        score: 0,
      },
    });

    const data = {
      id: 42,
      name: "test",
      score: 3.14,
    };

    let encoded = new ProtoBuffer();
    schema.encode(data, encoded);
    encoded.seek(0);
    encoded = encoded.toShrunk();

    const decoded = schema.decode(encoded);
    expect(decoded).toMatchObject({
      id: 42,
      name: "test",
      score: 3.14,
    });

    const refBytes = new Uint8Array([0x08, 0x2A, 0x12, 0x04, 0x54, 0x45, 0x53, 0x54, 0x1D, 0x00, 0x00, 0x9D, 0x43]);
    encoded.seek(0);
    expect(encoded.bytes().toUint8Array()).toStrictEqual(refBytes);
  });

  test('nested transform', () => {
    const innerMsg = v.message({
      value: v.string(1),
    }).transform<{ value: bigint }>({
      encode: (value) => ({ value: value.value.toString() }),
      decode: (value) => ({ value: BigInt(value.value ?? 0) }),
      default: { value: 0n },
    });

    const schema1 = v.message({
      id: v.int32(1),
      inner: v.submessage(2, innerMsg),
    });

    let data: any = {
      id: 42,
      inner: { value: 123n },
    };

    let encoded = schema1.encode(data, new ProtoBuffer(new Uint8Array(100))).seek(0).toShrunk();
    let decoded = schema1.decode(encoded);
    expect(decoded).toMatchObject({
      id: 42,
      inner: { value: 123n },
    });

    const schema2 = v.message({
      id: v.int32(1),
      inner: v.submessage(2, {
        value: v.string(1),
      }),
    });

    // Verify that the transformation is applied afterwards and not baked into the wire data.
    let decoded2 = schema2.decode(encoded.seek(0));
    expect(decoded2).toMatchObject({
      id: 42,
      inner: { value: '123' },
    });
  });

  test('complex', () => {
    const schema = v.message({
      sender: v.string(1),
      metadata: v.submessage(2, {
        description: v.string(1),
        denomUnits: v.repeated.submessage(2, {
          denom: v.string(1),
          exponent: v.uint32(2),
          aliases: v.repeated.string(3),
        }),
        base: v.string(3),
        display: v.string(4),
        name: v.string(5),
        symbol: v.string(6),
        uri: v.string(7),
        uriHash: v.string(8),
      }),
    });

    const payload = { // 48 + 271 = 319 bytes
      sender: 'neutron15fa97l48ru95cks5xj4hd8l5xy6vctp2p38mls', // 48 bytes
      metadata: { // 3 (header + 2 bytes len) + 84 + 83 + 62 + 7 + 25 + 7 = 271 bytes
        description: 'As the name suggests, this is just another test token. Nothing more, nothing less.', // 84 bytes
        denomUnits: [ // (2 + 70) + (2 + 9) = 83 bytes (first number is header + len)
          { // 62 + 0 + 8 = 70 bytes
            denom: 'factory/neutron15fa97l48ru95cks5xj4hd8l5xy6vctp2p38mls/jatto', // 62 bytes
            exponent: 0, // 0 bytes (default value)
            aliases: ['ujatto' /* 8 bytes */], // 8 bytes
          },
          { // 7 + 2 = 9 bytes
            denom: 'jatto', // 7 bytes
            exponent: 6, // 2 bytes
          },
        ],
        base: 'factory/neutron15fa97l48ru95cks5xj4hd8l5xy6vctp2p38mls/jatto', // 62 bytes
        display: 'jatto', // 7 bytes
        name: 'Just Another Test Token', // 25 bytes
        symbol: 'JATTO', // 7 bytes
      },
    };
    const encoded = schema.encode(payload).toShrunk().seek(0);
    expect(schema.length(payload)).toBe(319);
    expect(encoded.writtenLength).toBe(319);
  });

  test('required', () => {
    // note: `required` is a decode-time check and has no actual effect on the wire data
    // for encoding, it's just an ephemeral type check
    const schema = v.message({
      name: v.string(1).required(),
      payload: v.bytes(2).required(),
      vector: v.repeated.float(3).required(),
      flags: v.uint32(4).required(),
    });

    // construct invalid payload
    const encoded = v.message({
      name: v.string(1),
    }).encode({
      name: 'hello',
    }).toShrunk().seek(0);

    const decoded = schema.decode(encoded);
    expect(decoded).toMatchObject({
      name: 'hello',
      payload: new Uint8Array(),
      vector: [],
      flags: 0,
    });
  });

  test('variants', () => {
    const schema = v.variants('type', {
      foo: v.message({
        value: v.string(1),
      }),
      bar: v.message({
        value: v.int32(1),
      }),
    });

    let payload: v.infer<typeof schema> = {
      type: 'foo',
      value: 'hello',
    };

    debugger;
    let encoded = schema.encode(payload).toShrunk().seek(0);
    console.log(encoded.toShrunk().toHex());
    expect(schema.decode(encoded)).toMatchObject(payload);

    payload = {
      type: 'bar',
      value: 42,
    };

    encoded = schema.encode(payload).toShrunk().seek(0);
    expect(schema.decode(encoded)).toMatchObject(payload);
  });
});
