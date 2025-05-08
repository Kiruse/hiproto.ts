export enum WireType {
  Varint = 0,
  I64 = 1,
  Len = 2,
  SGroup = 3,
  EGroup = 4,
  I32 = 5,
}

/** Custom buffer class optimized for reading & writing protobuf wire format. */
export class ProtoBuffer {
  #buffer: Uint8Array;
  #view: DataView;
  #offset = 0;
  #writtenLength = 0;

  constructor(buffer: Uint8Array, offset = 0, length = buffer.length - offset) {
    this.#buffer = buffer;
    this.#view = new DataView(buffer.buffer, offset, length);
  }

  /** Write a field header to the buffer. */
  writeFieldHeader(index: number, ty: WireType) {
    if (index >> 5) throw new RangeError('Field index too large');
    this.#assertSize(1);
    this.#buffer[this.#offset++] = (index << 3) | ty;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeFloat(value: number) {
    this.#assertSize(4);
    this.#view.setFloat32(this.#offset, value, true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeFixed32(value: number | bigint) {
    this.#assertSize(4);
    this.#view.setUint32(this.#offset, Number(value), true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeSfixed32(value: number) {
    this.#assertSize(4);
    this.#view.setInt32(this.#offset, value, true);
    this.#offset += 4;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeDouble(value: number) {
    this.#assertSize(8);
    this.#view.setFloat64(this.#offset, value, true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeFixed64(value: number | bigint) {
    this.#assertSize(8);
    this.#view.setBigUint64(this.#offset, BigInt(value), true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeSfixed64(value: number | bigint) {
    this.#assertSize(8);
    this.#view.setBigInt64(this.#offset, BigInt(value), true);
    this.#offset += 8;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeVarint(value: number | bigint, zigzag = false) {
    value = BigInt(value);
    const isNegative = value < 0n;
    if (value === 0n) {
      this.#assertSize(1);
      this.#buffer[this.#offset++] = 0;
      this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
      return this;
    }

    if (bnAbs(value) >> 64n) throw new RangeError('Value has more than 64 bits');

    // zigzag encoding for signed integers
    if (zigzag) value = isNegative ? ((~value) << 1n) | 1n : value << 1n;

    value = BigInt.asUintN(64, value);

    while (value > 0n) {
      let byte = Number(value & 0x7fn);
      value >>= 7n;
      if (value > 0n) {
        byte |= 0x80;
      }
      this.#assertSize(1);
      this.#buffer[this.#offset++] = byte;
    }
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  writeZigzag(value: number | bigint) {
    return this.writeVarint(Number(value), true);
  }

  writeBytes(value: Uint8Array) {
    this.#assertSize(value.length);
    this.#buffer.set(value, this.#view.byteOffset + this.#offset);
    this.#offset += value.length;
    this.#writtenLength = Math.max(this.#writtenLength, this.#offset);
    return this;
  }

  /** Read a field header from the buffer. */
  readFieldHeader() {
    this.#assertSize(1);
    const header = this.#buffer[this.#offset++]!;
    const index = header >> 3;
    const wiretype = (header & 0x7) as WireType;
    return { index, wiretype };
  }

  readFloat(): number {
    this.#assertSize(4);
    const result = this.#view.getFloat32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readDouble(): number {
    this.#assertSize(8);
    const result = this.#view.getFloat64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readFixed32(): number {
    this.#assertSize(4);
    const result = this.#view.getUint32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readSfixed32(): number {
    this.#assertSize(4);
    const result = this.#view.getInt32(this.#offset, true);
    this.#offset += 4;
    return result;
  }

  readFixed64(): bigint {
    this.#assertSize(8);
    const result = this.#view.getBigUint64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readSfixed64(): bigint {
    this.#assertSize(8);
    const result = this.#view.getBigInt64(this.#offset, true);
    this.#offset += 8;
    return result;
  }

  readUvarint(): bigint {
    let result = 0n;
    let shift = 0n;
    let byte: number;

    do {
      if (this.#offset >= this.#view.byteLength)
        throw new Error('Buffer underflow');
      byte = this.#buffer[this.#offset]!;
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

  readBytes(length: number): Uint8Array {
    this.#assertSize(length);
    const result = this.#buffer.slice(this.#view.byteOffset + this.#offset, this.#view.byteOffset + this.#offset + length);
    this.#offset += length;
    return result;
  }

  slice(length: number): ProtoBuffer {
    return new ProtoBuffer(this.#buffer, this.#view.byteOffset + this.#offset, length);
  }

  #assertSize(size: number) {
    if (this.#view.byteLength - this.#offset < size) {
      throw new Error('Buffer too small');
    }
  }

  /** Returns the bytes that this buffer is limited to. */
  bytes() {
    return this.#buffer.slice(this.#view.byteOffset, this.#view.byteOffset + this.#view.byteLength);
  }

  /** Similar to `bytes()`, but only includes the bytes that were written to the buffer. Useful
   * for when the actual length of the payload is unknown.
   */
  writtenBytes() {
    return this.#buffer.slice(this.#view.byteOffset, this.#view.byteOffset + this.#writtenLength);
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

  /** Computes the length of a signed and unsigned varint. */
  static varintLength(value: number | bigint): number {
    throw new Error('Not yet implemented');
  }

  /** Computes the length of a signed, zigzag encoded varint. */
  static zigzagLength(value: number | bigint): number {
    throw new Error('Not yet implemented');
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
}

const bnAbs = (value: bigint) => value < 0n ? -value : value;
