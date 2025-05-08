import { ProtoBuffer } from './protobuffer';
import { v } from './validators';

describe('validators', () => {
  it('bool', () => {
    const val = v.bool(1);
    let buffer = new ProtoBuffer(new Uint8Array(2));
    val.encode(true, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(true);
  });

  it('bool, non-standard', () => {
    const val = v.bool(1);
    let buffer = new ProtoBuffer(new Uint8Array(2));
    buffer.writeFieldHeader(1, 0);
    buffer.writeVarint(42);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(true);
  });

  it('float', () => {
    const val = v.float(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(3.14, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(5);
    expect(val.decode(buffer)).toBeCloseTo(3.14);
  });

  it('double', () => {
    const val = v.double(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.encode(3.14159265359, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(9);
    expect(val.decode(buffer)).toBeCloseTo(3.14159265359);
  });

  it('int32', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(42);
  });

  it('int32 negative', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(11);
    expect(val.decode(buffer)).toBe(-42);
  });

  it('int32 min/max', () => {
    const val = v.int32(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));

    // Test minimum value (-2^31)
    val.encode(-2147483648, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(11);
    expect(val.decode(buffer)).toBe(-2147483648);

    // Test maximum value (2^31 - 1)
    buffer = new ProtoBuffer(new Uint8Array(11));
    val.encode(2147483647, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(6);
    expect(val.decode(buffer)).toBe(2147483647);
  });

  it('int64', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(42n);
  });

  it('int64 negative', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));
    val.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(11);
    expect(val.decode(buffer)).toBe(-42n);
  });

  it('int64 min/max', () => {
    const val = v.int64(1);
    let buffer = new ProtoBuffer(new Uint8Array(11));

    // Test minimum value (-2^63)
    val.encode(-9223372036854775808n, buffer);
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(11);
    expect(val.decode(buffer)).toBe(-9223372036854775808n);

    // Test maximum value (2^63 - 1)
    buffer = new ProtoBuffer(new Uint8Array(11));
    val.encode(9223372036854775807n, buffer);
    console.log(buffer.writtenBytes());
    buffer.seek(0);
    expect(buffer.writtenLength).toBe(10);
    expect(val.decode(buffer)).toBe(9223372036854775807n);
  });

  it('uint32', () => {
    const val = v.uint32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(42);
  });

  it('uint64', () => {
    const val = v.uint64(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(42n);
  });

  it('sint32', () => {
    const val = v.sint32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(-42);
  });

  it('sint64', () => {
    const val = v.sint64(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(-42n);
  });

  it('fixed32', () => {
    const val = v.fixed32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(5);
    expect(val.decode(buffer)).toBe(42);
  });

  it('fixed64', () => {
    const val = v.fixed64(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.encode(42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(9);
    expect(val.decode(buffer)).toBe(42n);
  });

  it('sfixed32', () => {
    const val = v.sfixed32(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(-42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(5);
    expect(val.decode(buffer)).toBe(-42);
  });

  it('sfixed64', () => {
    const val = v.sfixed64(1);
    let buffer = new ProtoBuffer(new Uint8Array(9));
    val.encode(-42n, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(9);
    expect(val.decode(buffer)).toBe(-42n);
  });

  it('enum', () => {
    const val = v.enum(1);
    let buffer = new ProtoBuffer(new Uint8Array(5));
    val.encode(42, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(2);
    expect(val.decode(buffer)).toBe(42);
  });

  it('string', () => {
    const val = v.string(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    val.encode('hello', buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(7);
    expect(val.decode(buffer)).toBe('hello');
  });

  it('bytes', () => {
    const val = v.bytes(1);
    let buffer = new ProtoBuffer(new Uint8Array(10));
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    val.encode(data, buffer);
    buffer.seek(0);

    expect(buffer.writtenLength).toBe(7);
    expect(val.decode(buffer)).toEqual(data);
  });
});
