import { describe, expect, test } from 'bun:test';
import { Bytes, ProtoBuffer } from './protobuffer';
import { v } from './schema';

describe('schemas', () => {
  test('integer types', () => {
    const schema = v.message({
      int32: v.int32(1),
      uint32: v.uint32(2),
      sint32: v.sint32(3),
      int64: v.int64(4),
      uint64: v.uint64(5),
      sint64: v.sint64(6),
    });

    const data = {
      int32: -42,
      uint32: 42,
      sint32: -42,
      int64: -42n,
      uint64: 42n,
      sint64: -42n,
    };

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode(data, buffer);
    buffer.seek(0);
    buffer = buffer.toShrunk();

    expect(schema.decode(buffer)).toMatchObject(data);
  });

  test('fixed types', () => {
    const schema = v.message({
      fixed32: v.fixed32(1),
      fixed64: v.fixed64(2),
      sfixed32: v.sfixed32(3),
      sfixed64: v.sfixed64(4),
    });

    const data = {
      fixed32: 42,
      fixed64: 42n,
      sfixed32: -42,
      sfixed64: -42n,
    };

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode(data, buffer);
    buffer.seek(0);
    buffer = buffer.toShrunk();

    expect(schema.decode(buffer)).toMatchObject(data);
  });

  test('floating point types', () => {
    const schema = v.message({
      float: v.float(1),
      double: v.double(2),
    });

    const data = {
      float: 3.14159,
      double: 3.14159265359,
    };

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode(data, buffer);
    buffer.seek(0);
    buffer = buffer.toShrunk();

    const decoded = schema.decode(buffer);
    expect(decoded.float).toBeCloseTo(data.float, 5);
    expect(decoded.double).toBeCloseTo(data.double, 10);
  });

  test('boolean type', () => {
    const schema = v.message({
      bool: v.bool(1),
    });

    const data = {
      bool: true,
    };

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode(data, buffer);
    buffer.seek(0);
    buffer = buffer.toShrunk();

    expect(schema.decode(buffer)).toMatchObject(data);
  });

  test('string and bytes types', () => {
    const schema = v.message({
      string: v.string(1),
      bytes: v.bytes(2),
    });

    const data = {
      string: "Hello, World!",
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
    };

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode(data, buffer);
    buffer.seek(0);
    buffer = buffer.toShrunk();

    let decoded = schema.decode(buffer);
    expect(decoded.string).toBe(data.string);
    expect(Bytes.getUint8Array(decoded.bytes!)).toEqual(data.bytes);
  });

  test('transform, single', () => {
    const schema = v.message({
      value: v.string(1).transform<bigint>({
        encode: (value) => value.toString(),
        decode: (value) => BigInt(value),
        default: 0n,
      }),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      value: 42n, // 4 bytes (header + len + 2 bytes, actual value is string "42")
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();

    expect(buffer.writtenLength).toBe(4);
    expect(schema.decode(buffer)).toMatchObject({ value: 42n });
  });

  test('transform, double', () => {
    const schema = v.message({
      value: v.string(1)
        .transform<bigint>({
          encode: (value) => value.toString(),
          decode: (value) => BigInt(value),
          default: 0n,
        })
        .transform<number>({
          encode: (value) => BigInt(value),
          decode: (value) => Number(value),
          default: 0,
        }),
    });

    let buffer = new ProtoBuffer(new Uint8Array(100));
    schema.encode({
      value: 42,
    }, buffer);
    buffer.seek(0);

    buffer = buffer.toShrunk();

    expect(buffer.writtenLength).toBe(4);
    expect(schema.decode(buffer)).toMatchObject({ value: 42 });
  });
});
