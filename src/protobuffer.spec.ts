import { describe, expect, test } from 'bun:test';
import { Bytes, ProtoBuffer } from './protobuffer';

describe('ProtoBuffer', () => {
  describe('varint', () => {
    test('bytes', () => {
      let ref = new Bytes(crypto.getRandomValues(new Uint8Array(10)), [2, 10]);
      let buffer = new ProtoBuffer(ref);
      expect(buffer.toHex()).toStrictEqual(ref.toHex());

      ref = new Bytes(ref.buffer, [2, 4]);
      buffer = new ProtoBuffer(ref);
      expect(buffer.toHex()).toStrictEqual(ref.toHex());
    });

    test('zero', () => {
      const buffer = new ProtoBuffer(new Uint8Array(1));
      buffer.writeZigzag(0);
      buffer.seek(0);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x00]));
      expect(buffer.readZigzag()).toBe(0n);
    });

    test('positive, zigzag', () => {
      const getBuffer = (value: number) =>
        new ProtoBuffer(new Uint8Array(10)).writeZigzag(value).seek(0);

      let buffer = getBuffer(0);
      expect(buffer.readZigzag()).toBe(0n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x00]));

      buffer = getBuffer(1);
      expect(buffer.readZigzag()).toBe(1n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x02]));

      buffer = getBuffer(127);
      expect(buffer.readZigzag()).toBe(127n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFE, 0x01]));

      buffer = getBuffer(128);
      expect(buffer.readZigzag()).toBe(128n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0x02]));

      buffer = getBuffer(255);
      expect(buffer.readZigzag()).toBe(255n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFE, 0x03]));

      buffer = getBuffer(256);
      expect(buffer.readZigzag()).toBe(256n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0x04]));

      buffer = getBuffer(65535);
      expect(buffer.readZigzag()).toBe(65535n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFE, 0xFF, 0x07]));
    });

    test('positive, no zigzag', () => {
      const getBuffer = (value: number) =>
        new ProtoBuffer(new Uint8Array(10)).writeVarint(value).seek(0);

      let buffer = getBuffer(0);
      expect(buffer.readVarint()).toBe(0n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x00]));

      buffer = getBuffer(1);
      expect(buffer.readVarint()).toBe(1n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x01]));

      buffer = getBuffer(2);
      expect(buffer.readVarint()).toBe(2n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x02]));

      buffer = getBuffer(127);
      expect(buffer.readVarint()).toBe(127n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x7F]));

      buffer = getBuffer(128);
      expect(buffer.readVarint()).toBe(128n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0x01]));

      buffer = getBuffer(255);
      expect(buffer.readVarint()).toBe(255n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFF, 0x01]));

      buffer = getBuffer(256);
      expect(buffer.readVarint()).toBe(256n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0x02]));

      buffer = getBuffer(65535);
      expect(buffer.readVarint()).toBe(65535n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFF, 0xFF, 0x03]));
    });

    test('negative, zigzag', () => {
      const getBuffer = (value: number) =>
        new ProtoBuffer(new Uint8Array(10)).writeZigzag(value).seek(0);

      let buffer = getBuffer(-1);
      expect(buffer.readZigzag()).toBe(-1n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x01]));

      buffer = getBuffer(-2);
      expect(buffer.readZigzag()).toBe(-2n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x03]));

      buffer = getBuffer(-127);
      expect(buffer.readZigzag()).toBe(-127n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFD, 0x01]));

      buffer = getBuffer(-128);
      expect(buffer.readZigzag()).toBe(-128n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFF, 0x01]));

      buffer = getBuffer(-255);
      expect(buffer.readZigzag()).toBe(-255n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFD, 0x03]));

      buffer = getBuffer(-256);
      expect(buffer.readZigzag()).toBe(-256n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFF, 0x03]));

      buffer = getBuffer(-65535);
      expect(buffer.readZigzag()).toBe(-65535n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFD, 0xFF, 0x07]));
    });

    test('negative, no zigzag', () => {
      const getBuffer = (value: number) =>
        new ProtoBuffer(new Uint8Array(10)).writeVarint(value).seek(0);

      let buffer = getBuffer(-1);
      expect(buffer.readVarint()).toBe(-1n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-2);
      expect(buffer.readVarint()).toBe(-2n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-127);
      expect(buffer.readVarint()).toBe(-127n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x81, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-128);
      expect(buffer.readVarint()).toBe(-128n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-255);
      expect(buffer.readVarint()).toBe(-255n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x81, 0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-256);
      expect(buffer.readVarint()).toBe(-256n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x80, 0xFE, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));

      buffer = getBuffer(-65535);
      expect(buffer.readVarint()).toBe(-65535n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0x81, 0x80, 0xFC, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x01]));
    });

    test('many read/write', () => {
      const values = [1, -1, 2, -2, 127, -128, 255, -256];
      const buffer = new ProtoBuffer(new Uint8Array(values.length * 10));

      // Write all values
      for (const value of values) {
        buffer.writeZigzag(value);
      }

      buffer.seek(0);

      // Read all values back
      for (const value of values) {
        const decoded = buffer.readZigzag();
        expect(Number(decoded)).toBe(value);
      }
    });

    test('throw on buffer overflow', () => {
      const buffer = new ProtoBuffer(new Bytes(new Uint8Array(1), [0, 1]));
      debugger;
      expect(() => buffer.writeVarint(255)).toThrow('Buffer overflow');
    });

    test('throw on buffer underflow', () => {
      const bytes = new Uint8Array(10);
      let buffer = new ProtoBuffer(bytes);
      buffer.writeVarint(0xFFFFFFFFFFFFFFFFn);

      buffer = new ProtoBuffer(new Bytes(bytes, [0, 1]));
      expect(() => buffer.readVarint()).toThrow('Buffer underflow');
    });

    test('length, zigzag', () => {
      expect(ProtoBuffer.zigzagLength(0n)).toBe(1);
      expect(ProtoBuffer.zigzagLength(1n)).toBe(1);
      expect(ProtoBuffer.zigzagLength(2n)).toBe(1);
      expect(ProtoBuffer.zigzagLength(127n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(128n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(255n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(256n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(65535n)).toBe(3);

      expect(ProtoBuffer.zigzagLength(-1n)).toBe(1);
      expect(ProtoBuffer.zigzagLength(-2n)).toBe(1);
      expect(ProtoBuffer.zigzagLength(-127n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(-128n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(-255n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(-256n)).toBe(2);
      expect(ProtoBuffer.zigzagLength(-65535n)).toBe(3);
    });

    test('length, no zigzag', () => {
      expect(ProtoBuffer.varintLength(0n)).toBe(1);
      expect(ProtoBuffer.varintLength(1n)).toBe(1);
      expect(ProtoBuffer.varintLength(2n)).toBe(1);
      expect(ProtoBuffer.varintLength(127n)).toBe(1);
      expect(ProtoBuffer.varintLength(128n)).toBe(2);
      expect(ProtoBuffer.varintLength(255n)).toBe(2);
      expect(ProtoBuffer.varintLength(256n)).toBe(2);
      expect(ProtoBuffer.varintLength(65535n)).toBe(3);

      expect(ProtoBuffer.varintLength(-1n)).toBe(10);
      expect(ProtoBuffer.varintLength(-2n)).toBe(10);
      expect(ProtoBuffer.varintLength(-127n)).toBe(10);
      expect(ProtoBuffer.varintLength(-128n)).toBe(10);
      expect(ProtoBuffer.varintLength(-255n)).toBe(10);
      expect(ProtoBuffer.varintLength(-256n)).toBe(10);
      expect(ProtoBuffer.varintLength(-65535n)).toBe(10);
    });
  });

  describe('scalars', () => {
    test('float', () => {
      const buffer = new ProtoBuffer(new Uint8Array(4));
      buffer.writeFloat(1.234);
      buffer.seek(0);
      expect(buffer.readFloat()).toBeCloseTo(1.234);
    });

    test('double', () => {
      const buffer = new ProtoBuffer(new Uint8Array(8));
      buffer.writeDouble(1.234);
      buffer.seek(0);
      expect(buffer.readDouble()).toBeCloseTo(1.234);
    });

    test('fixed32', () => {
      const buffer = new ProtoBuffer(new Uint8Array(4));
      buffer.writeFixed32(1234);
      buffer.seek(0);
      expect(buffer.readFixed32()).toBe(1234);
    });

    test('fixed64', () => {
      const buffer = new ProtoBuffer(new Uint8Array(8));
      buffer.writeFixed64(1234);
      buffer.seek(0);
      expect(buffer.readFixed64()).toBe(1234n);
      expect(buffer.writtenBytes().toUint8Array()).toStrictEqual(new Uint8Array([0xD2, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    });
  });
});
