import { describe, expect, test } from 'bun:test';
import { Bytes, ProtoBuffer } from './protobuffer';
import { v } from './schema';

describe('codecs', () => {
  test('bool', () => {
    const val = v.bool(1);
    let buffer = new ProtoBuffer(new Uint8Array(2));
    val.codec.encode(true, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(true);
  });

  test('bool, non-standard', () => {
    const val = v.bool(1);
    let buffer = new ProtoBuffer(new Uint8Array(2));
    buffer.writeFieldHeader(1, 0);
    buffer.writeVarint(42);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.codec.decode(buffer)).toBe(true);
  });

  test('float', () => {
    const val = v.float(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(3.14, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(4);
    expect(val.codec.decode(buffer)).toBeCloseTo(3.14);
  });

  test('double', () => {
    const val = v.double(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.codec.encode(3.14159265359, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(8);
    expect(val.codec.decode(buffer)).toBeCloseTo(3.14159265359);
  });

  test('int32', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(42);
  });

  test('int32 negative', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.codec.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(10);
    expect(val.codec.decode(buffer)).toBe(-42);
  });

  test('int32 min/max', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));

    // Test minimum value (-2^31)
    val.codec.encode(-2147483648, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(10);
    expect(val.codec.decode(buffer)).toBe(-2147483648);

    // Test maximum value (2^31 - 1)
    buffer = new ProtoBuffer(new Uint8Array(11));
    val.codec.encode(2147483647, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(5);
    expect(val.codec.decode(buffer)).toBe(2147483647);
  });

  test('int64', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.codec.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(42n);
  });

  test('int64 negative', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.codec.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(10);
    expect(val.codec.decode(buffer)).toBe(-42n);
  });

  test('int64 min/max', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));

    // Test minimum value (-2^63)
    val.codec.encode(-9223372036854775808n, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(10);
    expect(val.codec.decode(buffer)).toBe(-9223372036854775808n);

    // Test maximum value (2^63 - 1)
    buffer = new ProtoBuffer(new Uint8Array(11));
    val.codec.encode(9223372036854775807n, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(9);
    expect(val.codec.decode(buffer)).toBe(9223372036854775807n);
  });

  test('uint32', () => {
    const val = v.uint32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(42);
  });

  test('uint64', () => {
    const val = v.uint64(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.codec.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(42n);
  });

  test('sint32', () => {
    const val = v.sint32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(-42);
  });

  test('sint64', () => {
    const val = v.sint64(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.codec.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(-42n);
  });

  test('fixed32', () => {
    const val = v.fixed32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(4);
    expect(val.codec.decode(buffer)).toBe(42);
  });

  test('fixed64', () => {
    const val = v.fixed64(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.codec.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(8);
    expect(val.codec.decode(buffer)).toBe(42n);
  });

  test('sfixed32', () => {
    const val = v.sfixed32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(4);
    expect(val.codec.decode(buffer)).toBe(-42);
  });

  test('sfixed64', () => {
    const val = v.sfixed64(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.codec.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(8);
    expect(val.codec.decode(buffer)).toBe(-42n);
  });

  test('enum', () => {
    const val = v.enum(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.codec.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(1);
    expect(val.codec.decode(buffer)).toBe(42);
  });

  test('string', () => {
    const val = v.string(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.codec.encode('hello', buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(6);
    expect(val.codec.decode(buffer)).toBe('hello');
  });

  test('bytes', () => {
    const val = v.bytes(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    val.codec.encode(data, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(6);
    expect(Bytes.getUint8Array(val.codec.decode(buffer))).toEqual(data);
  });

  test('packed', () => {
    let val = v.message({
      values: v.repeated.float(1),
    });
    expect(val.length({ values: [3.14, 2.718, 1.618] })).toBe(2 + 4 * 3);
  });
});
