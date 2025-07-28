export enum WireType {
  Varint = 0,
  I64 = 1,
  Len = 2,
  SGroup = 3,
  EGroup = 4,
  I32 = 5,
}

/** A wrapper around a `Uint8Array` that allows for efficient slicing & resizing.
 * However, resizing is only allowed if the buffer is not a slice of another.
 */
export class Bytes {
  #buffer: Uint8Array;
  #view: DataView;

  constructor(
    buffer: Uint8Array = new Uint8Array(),
    /** Range indices that this `Bytes` is restricted to. */
    public readonly range?: [number, number]
  ) {
    this.#buffer = buffer;
    this.#view = getView(this.#buffer, this.range);
  }

  get(index: number) {
    const [start = 0, end = this.#buffer.length] = this.range ?? [];
    if (index < 0 || index >= end)
      throw new RangeError('Index out of bounds');
    return this.#buffer[start + index]!;
  }

  set(index: number, value: Uint8Array | number) {
    const [start = 0, end = this.buffer.length] = this.range ?? [];
    if (typeof value === 'number') {
      this.buffer[start + index] = value;
    } else {
      if (index + value.length > end)
        throw new RangeError('Buffer overflow');
      this.buffer.set(value, start + index);
    }
    return this;
  }

  resize(size: number) {
    if (!this.resizable) throw new Error('Buffer overflow');
    const newBuffer = new Uint8Array(size);
    newBuffer.set(this.buffer);
    this.#buffer = newBuffer;
    this.#view = getView(this.#buffer, this.range);
    return this;
  }

  ensureCapacity(size: number) {
    if (this.buffer.length < size) this.resize(size);
    return this;
  }

  getView(start = 0, end?: number) {
    if (!start && !end) return this.view;
    const [myStart, myEnd] = this.range ?? [0, this.buffer.length];
    if (start < 0 || (end && (end > myEnd - myStart)))
      throw new RangeError('Slice out of bounds');
    return new DataView(this.buffer.buffer, myStart + start, end ? myStart + end : myEnd);
  }

  slice(start = 0, end?: number) {
    const [myStart, myEnd] = this.range ?? [0, this.buffer.length];
    if (start < 0 || (end && end > myEnd - myStart))
      throw new RangeError('Slice out of bounds');
    return new Bytes(this.buffer, [myStart + start, end ? myStart + end : myEnd]);
  }

  toUint8Array() {
    const [start = 0, end = this.#buffer.length] = this.range ?? [];
    return this.#buffer.slice(start, end);
  }

  toHex() {
    const [start = 0, end = this.#buffer.length] = this.range ?? [];
    return Array.from(this.#buffer.slice(start, end)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static fromHex(hex: string) {
    if (hex.length % 2 !== 0) throw new Error('Hex string must be even length');
    const buffer = new Uint8Array(hex.length >> 1);
    for (let i = 0; i < hex.length; i += 2) {
      buffer[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return new Bytes(buffer);
  }

  static getUint8Array(bytes: Uint8Array | Bytes) {
    return bytes instanceof Bytes ? bytes.toUint8Array() : bytes;
  }

  /** Underlying buffer. Beware that this `Bytes` may represent a slice of this buffer. */
  get buffer() {
    return this.#buffer;
  }

  get view() {
    return this.#view;
  }

  get length() {
    const [start = 0, end = this.#buffer.length] = this.range ?? [];
    return end - start;
  }

  get resizable() {
    return this.range === undefined;
  }
}

function getView(buffer: Uint8Array, range?: [number, number]) {
  const [start = 0, end = buffer.length] = range ?? [0, buffer.length];
  return new DataView(buffer.buffer, start, end - start);
}

/** Custom buffer class optimized for reading & writing protobuf wire format. */
export class ProtoBuffer {
  #buffer: Bytes;
  #offset = 0;
  #writtenLength = 0;

  constructor(buffer: Uint8Array | Bytes = new Bytes()) {
    this.#buffer = buffer instanceof Bytes ? buffer : new Bytes(buffer);
  }

  /** Write a field header to the buffer. */
  writeFieldHeader(index: number, ty: WireType) {
    if (index >> 5) throw new RangeError('Field index too large');
    this.ensureCapacity(1);
    this.#buffer.set(this.#offset, (index << 3) | ty);
    this.#offset += 1;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeField(index: number, wiretype: WireType, value: any) {
    this.writeFieldHeader(index, wiretype);
    switch (wiretype) {
      case WireType.Varint:
        this.writeVarint(value);
        break;
      case WireType.I32:
        this.writeFixed32(value);
        break;
      case WireType.I64:
        this.writeFixed64(value);
        break;
      case WireType.Len:
        this.writeBytes(value);
        break;
      case WireType.SGroup:
      case WireType.EGroup:
        throw new Error('Group types are not supported');
    }
    return this;
  }

  writeFloat(value: number) {
    this.ensureCapacity(4);
    this.#buffer.view.setFloat32(this.#offset, value, true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeFixed32(value: number | bigint) {
    this.ensureCapacity(4);
    this.#buffer.view.setUint32(this.#offset, Number(value), true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeSfixed32(value: number) {
    this.ensureCapacity(4);
    this.#buffer.view.setInt32(this.#offset, value, true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeDouble(value: number) {
    this.ensureCapacity(8);
    this.#buffer.view.setFloat64(this.#offset, value, true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeFixed64(value: number | bigint) {
    this.ensureCapacity(8);
    this.#buffer.view.setBigUint64(this.#offset, BigInt(value), true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeSfixed64(value: number | bigint) {
    this.ensureCapacity(8);
    this.#buffer.view.setBigInt64(this.#offset, BigInt(value), true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeVarint(value: number | bigint) {
    value = BigInt(value);
    if (value === 0n) {
      this.ensureCapacity(1);
      this.#buffer.set(this.#offset, 0);
      this.#offset += 1;
      this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
      return this;
    }

    if (bnAbs(value) >> 64n) throw new RangeError('Value has more than 64 bits');

    value = BigInt.asUintN(64, value);

    while (value > 0n) {
      let byte = Number(value & 0x7fn);
      value >>= 7n;
      if (value > 0n) {
        byte |= 0x80;
      }
      this.ensureCapacity(1);
      this.#buffer.set(this.#offset++, byte);
    }
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeZigzag(value: number | bigint) {
    return this.writeVarint(getZigzag(BigInt(value)));
  }

  writeBytes(value: Uint8Array) {
    this.ensureCapacity(value.length);
    this.#buffer.set(this.#offset, value);
    this.#offset += value.length;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  peekFieldHeader() {
    this.assertCapacity(1);
    const header = this.#buffer.get(this.#offset);
    const index = header >> 3;
    const wiretype = (header & 0x7) as WireType;
    return { index, wiretype };
  }

  /** Read a field header from the buffer. */
  readFieldHeader() {
    const result = this.peekFieldHeader();
    this.#offset++;
    return result;
  }

  readWireType(wiretype: WireType) {
    switch (wiretype) {
      case WireType.Varint:
        return this.readVarint();
      case WireType.I32:
        return this.readFixed32();
      case WireType.I64:
        return this.readFixed64();
      case WireType.Len: {
        const length = Number(this.readVarint());
        return this.readBytes(length);
      }
      case WireType.SGroup:
      case WireType.EGroup:
        throw new Error('Group types are not supported');
    }
  }

  readFloat(): number {
    this.assertCapacity(4);
    const result = this.#buffer.view.getFloat32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readDouble(): number {
    this.assertCapacity(8);
    const result = this.#buffer.view.getFloat64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readFixed32(): number {
    this.assertCapacity(4);
    const result = this.#buffer.view.getUint32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readSfixed32(): number {
    this.assertCapacity(4);
    const result = this.#buffer.view.getInt32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readFixed64(): bigint {
    this.assertCapacity(8);
    const result = this.#buffer.view.getBigUint64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readSfixed64(): bigint {
    this.assertCapacity(8);
    const result = this.#buffer.view.getBigInt64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readUvarint(): bigint {
    let result = 0n;
    let shift = 0n;
    let byte: number;

    do {
      if (this.#offset >= this.#buffer.length)
        throw new Error('Buffer underflow');
      byte = this.#buffer.get(this.#offset);
      this.#offset++;
      result |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
    } while (byte & 0x80);

    return result;
  }

  /** Read a signed varint from the buffer. */
  readVarint(): bigint {
    return BigInt.asIntN(64, this.readUvarint());
  }

  readZigzag(): bigint {
    const result = this.readUvarint();
    return (result >> 1n) ^ -(result & 1n);
  }

  readBytes(length: number): Bytes {
    this.assertCapacity(length);
    const result = this.#buffer.slice(this.#offset, this.#offset + length);
    this.#offset += length;
    return result;
  }

  /** Returns a new sub-`ProtoBuffer` that points to the current buffer at the current offset with
   * reduced length.
   *
   * Unlike it's distant kin `Array.prototype.slice`, this method moves the internal offset forward
   * by the requested length. This follows the idea that the slice will be processed by the respective
   * sub-`ProtoBuffer` and the data will no longer be relevant to this `ProtoBuffer`.
   */
  slice(length: number): ProtoBuffer {
    const result = new ProtoBuffer(this.#buffer.slice(this.#offset, this.#offset + length));
    this.#offset += length;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return result;
  }

  ensureCapacity(size: number) {
    this.#buffer.ensureCapacity(this.#offset + size);
    return this;
  }

  assertCapacity(size: number) {
    if (this.#buffer.length - this.#offset < size) {
      throw new Error('Buffer overflow');
    }
  }

  /** Returns the bytes that this buffer is limited to. */
  bytes() {
    return this.#buffer.slice();
  }

  /** Similar to `bytes()`, but only includes the bytes that were written to the buffer. Useful
   * for when the actual length of the payload is unknown.
   */
  writtenBytes() {
    return this.#buffer.slice(0, this.#writtenLength);
  }

  /** Seek to a specific offset in the buffer. */
  seek(offset: number) {
    this.#offset = offset;
    return this;
  }

  /** Returns the current offset in the buffer. */
  tell() {
    return this.#offset;
  }

  /** Get a shrunk buffer that only contains the bytes that were written to the buffer.
   *
   * **Caveat:** Written length is quirky, and may not actually represent the number of actually
   * relevant bytes. Calling this method only makes sense at the end of a serialization process.
   */
  toShrunk() {
    const result = new ProtoBuffer(this.#buffer.slice(0, this.#writtenLength));
    result.#offset = this.#offset;
    result.#writtenLength = this.#writtenLength;
    return result;
  }

  toHex() {
    return this.#buffer.toHex();
  }

  /** Returns a `Uint8Array` that represents the bytes in the buffer.
   *
   * Often, you will want to chain this with `buffer.toShrunk().toUint8Array()` after serializing
   * data as the underlying buffer may be larger than necessary.
   */
  toUint8Array() {
    return this.#buffer.toUint8Array();
  }

  static fromHex(hex: string) {
    return new ProtoBuffer(Bytes.fromHex(hex));
  }

  /** Computes the length of a signed and unsigned varint. */
  static varintLength(value: number | bigint): number {
    value = BigInt(value);
    if (value === 0n) return 1;

    if (bnAbs(value) >> 64n) throw new RangeError('Value has more than 64 bits');

    value = BigInt.asUintN(64, value);
    let length = 0;

    while (value > 0n) {
      value >>= 7n;
      length++;
    }
    return length;
  }

  /** Computes the length of a signed, zigzag encoded varint. */
  static zigzagLength(value: number | bigint): number {
    return this.varintLength(getZigzag(BigInt(value)));
  }

  /** Computes the length of a packed array of primitives. */
  static packedLength(wiretype: WireType, values: any[]): number {
    switch (wiretype) {
      case WireType.Varint:
        return values.reduce((acc, value) => acc + this.varintLength(value), 0);
      case WireType.I32:
        return values.length * 4;
      case WireType.I64:
        return values.length * 8;
      case WireType.Len:
        throw new Error('Packed length is not supported for length-delimited fields');
      case WireType.SGroup:
      case WireType.EGroup:
        throw new Error('Packed length Group types are not supported');
    }
  }

  get offset() {
    return this.#offset;
  }

  set offset(value: number) {
    this.#offset = value;
  }

  get writtenLength() {
    return this.#writtenLength;
  }

  get remainingLength() {
    return this.#buffer.length - this.#offset;
  }
}

const bnAbs = (value: bigint) => value < 0n ? -value : value;
const getZigzag = (value: bigint) => value < 0n ? ((~value) << 1n) | 1n : value << 1n;
