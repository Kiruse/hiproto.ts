import { describe, expect, test } from 'bun:test';
import { Bytes, ProtoBuffer } from './protobuffer';
import { v } from './schema';

describe('schemas', () => {
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
        payload: v.bytes(3),
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
  });
});
