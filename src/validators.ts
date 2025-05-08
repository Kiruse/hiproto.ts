import { ProtoBuffer, WireType } from './protobuffer';

const InferType = Symbol('InferType');
const UnknownField = Symbol('UnknownField');

export interface Validator<T = unknown, S extends string = string> {
  [InferType]: T;
  type: S;
  encode: (value: T, buffer: ProtoBuffer) => void;
  decode: (buffer: ProtoBuffer) => T;
  /** Get the length of the encoded value in bytes. For `FieldValidator`s, this includes the field
   * header.
   *
   * **Note** that protobuf has no canonical representation, thus this value is only reliable for
   * bytes produced by this implementation.
   */
  length: (value: T) => number;
}

export interface FieldValidator<T, S extends string> extends Validator<T, S> {
  index: number;
}

type ValCtor<Args extends any[], T, S extends string> = new (...args: Args) => FieldValidator<T, S>;
type ValFactory<Args extends any[], T, S extends string> = (...args: Args) => FieldValidator<T, S>;

// TODO: T needs to be further constrained before we can actually write this class
export class MessageValidator<T> implements Validator<T, 'message'> {
  readonly [InferType]: T = undefined as any;
  readonly type = 'message';
  readonly fields: Readonly<Record<string, Validator>>;

  constructor(fields: Record<string, Validator>) {
    this.fields = fields;
  }

  encode(value: T, buffer: ProtoBuffer) {
    throw new Error('Not yet implemented');
  }
  decode(buffer: ProtoBuffer): T {
    throw new Error('Not yet implemented');
  }

  length(value: T): number {
    throw new Error('Not yet implemented');
  }
}

export abstract class FieldValidatorBase<T, S extends string> implements FieldValidator<T, S> {
  readonly [InferType]: T = undefined as any;
  abstract get type(): S;

  constructor(public readonly index: number) {}

  abstract encode(value: T, buffer: ProtoBuffer): void;
  abstract decode(buffer: ProtoBuffer): T;
  abstract length(value: T): number;
}

export class BoolValidator extends FieldValidatorBase<boolean, 'bool'> {
  readonly type = 'bool';

  encode(value: boolean, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value ? 1 : 0);
  }
  decode(buffer: ProtoBuffer) {
    // NOTE: technically, we should only expect the value to be 0 or 1...
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readVarint() !== 0n;
  }
  length(_value: boolean) {
    return 2;
  }
}

export class FloatValidator extends FieldValidatorBase<number, 'float'> {
  readonly type = 'float';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I32);
    buffer.writeFloat(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I32)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I32}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readFloat();
  }
  length(_value: number) {
    return 5;
  }
}

export class DoubleValidator extends FieldValidatorBase<number, 'double'> {
  readonly type = 'double';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I64);
    buffer.writeDouble(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I64)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I64}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readDouble();
  }
  length(_value: number) {
    return 9;
  }
}

export class Int32Validator extends FieldValidatorBase<number, 'int32'> {
  readonly type = 'int32';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return Number(buffer.readVarint());
  }
  length(value: number) {
    return 1 + ProtoBuffer.varintLength(value);
  }
}

export class Int64Validator extends FieldValidatorBase<bigint, 'int64'> {
  readonly type = 'int64';

  encode(value: bigint, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readVarint();
  }
  length(value: bigint) {
    return 1 + ProtoBuffer.varintLength(value);
  }
}

export class Uint32Validator extends FieldValidatorBase<number, 'uint32'> {
  readonly type = 'uint32';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return Number(buffer.readVarint());
  }
  length(value: number) {
    return 1 + ProtoBuffer.varintLength(value);
  }
}

export class Uint64Validator extends FieldValidatorBase<bigint, 'uint64'> {
  readonly type = 'uint64';

  encode(value: bigint, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readVarint();
  }
  length(value: bigint) {
    return 1 + ProtoBuffer.varintLength(value);
  }
}

export class Sint32Validator extends FieldValidatorBase<number, 'sint32'> {
  readonly type = 'sint32';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeZigzag(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return Number(buffer.readZigzag());
  }
  length(value: number) {
    return 1 + ProtoBuffer.zigzagLength(value);
  }
}

export class Sint64Validator extends FieldValidatorBase<bigint, 'sint64'> {
  readonly type = 'sint64';

  encode(value: bigint, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeZigzag(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readZigzag();
  }
  length(value: bigint) {
    return 1 + ProtoBuffer.zigzagLength(value);
  }
}

export class Fixed32Validator extends FieldValidatorBase<number, 'fixed32'> {
  readonly type = 'fixed32';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I32);
    buffer.writeSfixed32(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I32)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I32}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readSfixed32();
  }
  length(_value: number) {
    return 5;
  }
}

export class Fixed64Validator extends FieldValidatorBase<bigint, 'fixed64'> {
  readonly type = 'fixed64';

  encode(value: bigint, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I64);
    buffer.writeFixed64(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I64)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I64}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readFixed64();
  }
  length(_value: bigint) {
    return 9;
  }
}

export class Sfixed32Validator extends FieldValidatorBase<number, 'sfixed32'> {
  readonly type = 'sfixed32';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I32);
    buffer.writeSfixed32(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I32)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I32}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readSfixed32();
  }
  length(_value: number) {
    return 5;
  }
}

export class Sfixed64Validator extends FieldValidatorBase<bigint, 'sfixed64'> {
  readonly type = 'sfixed64';

  encode(value: bigint, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.I64);
    buffer.writeSfixed64(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.I64)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.I64}, got index ${index} & wiretype ${wiretype}`);
    return buffer.readSfixed64();
  }
  length(_value: bigint) {
    return 9;
  }
}

export class EnumValidator<T extends number> extends FieldValidatorBase<T, 'enum'> {
  readonly type = 'enum';

  encode(value: number, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Varint);
    buffer.writeVarint(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Varint)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Varint}, got index ${index} & wiretype ${wiretype}`);
    return Number(buffer.readVarint()) as T;
  }
  length(value: number) {
    return 1 + ProtoBuffer.varintLength(value);
  }
}

export class StringValidator extends FieldValidatorBase<string, 'string'> {
  readonly type = 'string';

  encode(value: string, buffer: ProtoBuffer) {
    const bytes = new TextEncoder().encode(value);
    return BytesValidator.prototype.encode.call(this, bytes, buffer);
  }
  decode(buffer: ProtoBuffer) {
    const bytes = BytesValidator.prototype.decode.call(this, buffer);
    return new TextDecoder().decode(bytes);
  }
  length(value: string) {
    return BytesValidator.prototype.length.call(this, new TextEncoder().encode(value));
  }
}

export class BytesValidator extends FieldValidatorBase<Uint8Array, 'bytes'> {
  readonly type = 'bytes';

  encode(value: Uint8Array, buffer: ProtoBuffer) {
    if (value.length > 0xffffffff)
      throw new EncodeError(`Bytes are too long: ${value.length} bytes, max is ${0xffffffff} (32 bits)`);
    buffer.writeFieldHeader(this.index, WireType.Len);
    buffer.writeVarint(value.length);
    buffer.writeBytes(value);
  }
  decode(buffer: ProtoBuffer) {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Len)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Len}, got index ${index} & wiretype ${wiretype}`);
    const length = Number(buffer.readVarint());
    return buffer.readBytes(length);
  }
  length(value: Uint8Array) {
    return 1 + ProtoBuffer.varintLength(value.length) + value.length;
  }
}

export class SubmessageValidator<T> extends FieldValidatorBase<T, 'message'> implements MessageValidator<T> {
  readonly type = 'message';

  constructor(
    index: number,
    public readonly fields: Record<string, FieldValidator<any, string>>,
  ) {
    super(index);
  }

  encode(value: T, buffer: ProtoBuffer) {
    buffer.writeFieldHeader(this.index, WireType.Len);
    buffer.writeVarint(MessageValidator.prototype.length.call(this, value));
    MessageValidator.prototype.encode.call(this, value, buffer);
  }
  decode(buffer: ProtoBuffer): T {
    const { index, wiretype } = buffer.readFieldHeader();
    if (index !== this.index || wiretype !== WireType.Len)
      throw new DecodeError(`Invalid field header: expected index ${this.index} & wiretype ${WireType.Len}, got index ${index} & wiretype ${wiretype}`);
    const length = Number(buffer.readVarint());
    return MessageValidator.prototype.decode.call(this, buffer.slice(length));
  }

  length(value: T): number {
    const length = MessageValidator.prototype.length.call(this, value);
    return length + 1 + ProtoBuffer.varintLength(length);
  }
}

export class PackedRepeatedValidator<T> extends FieldValidatorBase<T[], 'packed.repeated'> {
  readonly type = 'packed.repeated';

  constructor(
    index: number,
    public readonly validator: FieldValidator<T, string>,
  ) {
    super(index);
  }

  encode(value: T[], buffer: ProtoBuffer) {
    throw new Error('Not yet implemented');
  }
  decode(buffer: ProtoBuffer): T[] {
    throw new Error('Not yet implemented');
  }
  length(value: T[]): number {
    throw new Error('Not yet implemented');
  }
}

export class ExpandedRepeatedValidator<T> extends FieldValidatorBase<T[], 'repeated.expanded'> {
  readonly type = 'repeated.expanded';

  constructor(
    index: number,
    public readonly validator: FieldValidator<T, string>,
  ) {
    super(index);
  }

  encode(value: unknown[], buffer: ProtoBuffer) {
    // NOTE: since index is stored in this & the sub-validator, we assert that the sub-validator
    // produces bytes with the same index
    throw new Error('Not yet implemented');
  }
  decode(buffer: ProtoBuffer): T[] {
    throw new Error('Not yet implemented');
  }
  length(value: T[]): number {
    throw new Error('Not yet implemented');
  }
}

const valmap = {
  bool: BoolValidator,
  float: FloatValidator,
  double: DoubleValidator,
  int32: Int32Validator,
  int64: Int64Validator,
  uint32: Uint32Validator,
  uint64: Uint64Validator,
  sint32: Sint32Validator,
  sint64: Sint64Validator,
  fixed32: Fixed32Validator,
  fixed64: Fixed64Validator,
  sfixed32: Sfixed32Validator,
  sfixed64: Sfixed64Validator,
  enum: EnumValidator,
  string: StringValidator,
  bytes: BytesValidator,
  submessage: SubmessageValidator,
};

const fieldValidators = Object.fromEntries(Object.entries(valmap).map(([key, fn]) => [
  key,
  (...args: any[]) => new (fn as any)(...args),
])) as Validators;

export type Validators = {
  [K in keyof typeof valmap]: typeof valmap[K] extends ValCtor<infer Args, infer T, infer S>
    ? (...args: Args) => FieldValidator<T, S>
    : never;
};

export type RepeatedPackedValidators = {
  [K in Exclude<keyof Validators, 'bytes' | 'string' | 'message'>]: Validators[K] extends ValFactory<infer Args, infer T, any>
    ? (...args: Args) => PackedRepeatedValidator<T>
    : never;
};

export type RepeatedExpandedValidators = {
  [K in keyof Validators]: Validators[K] extends ValFactory<infer Args, infer T, any>
    ? (...args: Args) => ExpandedRepeatedValidator<T>
    : never;
};

export const v = {
  message: <T>(fields: Record<string, Validator>) => new MessageValidator<T>(fields),
  ...fieldValidators,
  repeated: {
    // NOTE: it's easiest to just ignore the TypeScript bits and pretend everything is correct
    packed: Object.fromEntries(
      Object.entries(fieldValidators).map(([key, fn]) => [
        key,
        //@ts-ignore
        (index: number, ...args: any[]) => new PackedRepeatedValidator(index, fn(index, ...args) as any),
      ]),
    ) as unknown as RepeatedPackedValidators,
    expanded: Object.fromEntries(
      Object.entries(fieldValidators).map(([key, fn]) => [
        key,
        //@ts-ignore
        (index: number, ...args: any[]) => new ExpandedRepeatedValidator(index, fn(index, ...args) as any),
      ]),
    ) as unknown as RepeatedExpandedValidators,
  },
};

export namespace v {
  // TODO: special treatment for repeated, submessage & map fields
  export type infer<T> = T extends Validator<infer U, any> ? U : never;
}

export class EncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncodeError';
  }
}

export class DecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecodeError';
  }
}
