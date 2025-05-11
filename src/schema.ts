import { Bytes, ProtoBuffer, WireType } from './protobuffer';

export const InferType = Symbol('InferType');
export const UnknownFields = Symbol('UnknownFields');

export type UnknownFieldsProp = {
  [UnknownFields]?: Record<number, { index: number, wiretype: WireType, value: any }>;
}

export interface Validator<T = unknown, S extends string = string> {
  [InferType]?: T;
  type: S;
  /** Get the length of the encoded value in bytes. For `FieldValidator`s, this includes the field
   * header.
   *
   * **Note** that protobuf has no canonical representation, thus this value is only reliable for
   * bytes produced by this implementation.
   */
  length(value: T): number;
}

export interface FieldSchema<T, S extends string> extends Validator<T, S> {
  index: number;
  wiretype: WireType;
  repeated: Repeatedness;
  codec: Codec<T>;
}

type MessageFields = Record<string, FieldSchema<any, any>>;

/** Repeatedness indicates whether a field should be an array or not. The different modes of
 * Repeatedness only affect the encoding process. Typically, `Default` should suffice for all
 * cases.
 *
 * Decoding, for the sake of backwards & forwards compatibility, always supports both packed
 * & expanded payloads.
 */
export enum Repeatedness {
  None = 0,
  /** Use default encoding of repeated fields.
   *
   * For numeric scalars, this means the field will be encoded as packed array. For strings, bytes,
   * and submessages, the only encoding is expanded anyways.
   */
  Default,
  /** Use expanded encoding of repeated fields.
   *
   * This is the only supported mode for strings, bytes, and submessages, but numeric scalars are
   * packed by default.
   */
  Expanded,
}

enum EncodeMode {
  Single,
  Packed,
  Expanded,
}

export class MessageValidator<T extends MessageFields> implements Validator<v.infer<T>, 'message'> {
  readonly [InferType]: v.infer<T> = undefined as any;
  readonly type = 'message';
  #fieldIndex: Record<number, string> = {};

  constructor(public readonly fields: Readonly<T>) {
    this.#fieldIndex = {};
    for (const key in fields) {
      const validator = fields[key];
      if (this.#fieldIndex[validator.index])
        throw new Error(`Duplicate field index: ${validator.index}, used by ${this.#fieldIndex[validator.index]} and ${key}`);
      this.#fieldIndex[validator.index] = key;
    }
  }

  encode(value: v.infer<T>, buffer = new ProtoBuffer()) {
    const val: any = value;

    for (const field in this.fields) {
      const schema = this.fields[field];
      const encodeMode = getEncodeMode(schema);

      if (!val[field] || schema.codec.isDefault(val[field])) continue;

      switch (encodeMode) {
        case EncodeMode.Single: {
          buffer.writeFieldHeader(schema.index, schema.wiretype);
          schema.codec.encode(val[field], buffer);
          break;
        }
        case EncodeMode.Packed: {
          const byteLength = val[field].reduce((acc: number, item: any) => acc + schema.codec.length(item), 0);
          buffer.writeFieldHeader(schema.index, WireType.Len);
          buffer.writeVarint(byteLength);
          buffer.assertCapacity(byteLength);
          for (const item of val[field] as any[]) {
            schema.codec.encode(item, buffer);
          }
          break;
        }
        case EncodeMode.Expanded: {
          buffer.writeFieldHeader(schema.index, schema.wiretype);
          for (const item of val[field] as any[]) {
            buffer.writeVarint(schema.codec.length(item));
            schema.codec.encode(item, buffer);
          }
          break;
        }
      }
    }

    if (val[UnknownFields]) {
      for (const { index, wiretype, value } of Object.values((val as UnknownFieldsProp)[UnknownFields]!)) {
        buffer.writeField(index, wiretype, value);
      }
    }

    return buffer;
  }

  decode(buffer: ProtoBuffer): v.infer<T> & UnknownFieldsProp {
    // step 1: read wire data into generic object
    const payload: any = {};
    const unknownFields = payload[UnknownFields] = {};
    while (buffer.remainingLength > 0) {
      const { index, wiretype } = buffer.readFieldHeader();
      const fieldName = this.#fieldIndex[index];

      if (!fieldName) {
        pushValue(unknownFields, index, { index, wiretype, value: buffer.readWireType(wiretype) });
        continue;
      }

      const schema = this.fields[fieldName]!;
      // packed fields
      if (wiretype === WireType.Len && schema.codec.wiretype !== WireType.Len) {
        const length = Number(buffer.readVarint());
        const subbuffer = buffer.slice(length);
        while (subbuffer.remainingLength > 0) {
          const item = schema.codec.decode(subbuffer);
          pushValue(payload, fieldName, item);
        }
      } else {
        pushValue(payload, fieldName, schema.codec.decode(buffer));
      }
    }

    // step 2: post-process & validate payload
    for (const field in this.fields) {
      const schema = this.fields[field]!;

      if (!payload[field]) {
        if (schema.repeated === Repeatedness.None) {
          payload[field] = schema.codec.default;
        } else {
          payload[field] = [];
        }
        continue;
      }

      if (schema.repeated === Repeatedness.None) {
        if (Array.isArray(payload[field]))
          throw new DecodeError(`Field ${field} is repeated, but schema expects a single value`);
      } else {
        if (!Array.isArray(payload[field]))
          payload[field] = [payload[field]];
      }
    }

    return payload;
  }

  length(value: v.infer<T>): number {
    let length = 0;
    for (const [key, schema] of Object.entries(this.fields) as [keyof T, FieldSchema<any, string>][] ) {
      // extra 1 byte for the field header
      length += 1 + schema.length(value[key as keyof v.infer<T>]);
    }
    return length;
  }
}

/** Algorithm for encoding & decoding of individual values. */
export interface Codec<In> {
  get wiretype(): WireType;
  get default(): In;
  encode(value: In, buffer: ProtoBuffer): void;
  decode(buffer: ProtoBuffer): In;
  length(value: In): number;
  isDefault(value: In): boolean;
}

export const codec = {
  bool: {
    get wiretype() { return WireType.Varint; },
    get default() { return false; },
    isDefault(value: boolean) { return value === false; },
    encode(value: boolean, buffer: ProtoBuffer) {
      buffer.writeVarint(value ? 1 : 0);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readVarint() !== 0n;
    },

    length(_value: boolean) {
      return 1;
    }
  } as Codec<boolean>,

  float: {
    get wiretype() { return WireType.I32; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeFloat(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readFloat();
    },

    length(_value: number) {
      return 4;
    }
  } as Codec<number>,

  double: {
    get wiretype() { return WireType.I64; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeDouble(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readDouble();
    },

    length(_value: number) {
      return 8;
    }
  } as Codec<number>,

  int32: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeVarint(value);
    },

    decode(buffer: ProtoBuffer) {
      return Number(BigInt.asIntN(32, buffer.readVarint()));
    },

    length(value: number) {
      return ProtoBuffer.varintLength(value);
    }
  } as Codec<number>,

  int64: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0n; },
    isDefault(value: bigint) { return value === 0n; },
    encode(value: bigint, buffer: ProtoBuffer) {
      buffer.writeVarint(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readVarint();
    },

    length(value: bigint) {
      return ProtoBuffer.varintLength(value);
    }
  } as Codec<bigint>,

  uint32: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeVarint(value);
    },

    decode(buffer: ProtoBuffer) {
      return Number(BigInt.asUintN(32, buffer.readUvarint()));
    },

    length(value: number) {
      return ProtoBuffer.varintLength(value);
    }
  } as Codec<number>,

  uint64: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0n; },
    isDefault(value: bigint) { return value === 0n; },
    encode(value: bigint, buffer: ProtoBuffer) {
      buffer.writeVarint(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readUvarint();
    },

    length(value: bigint) {
      return ProtoBuffer.varintLength(value);
    }
  } as Codec<bigint>,

  sint32: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeZigzag(value);
    },

    decode(buffer: ProtoBuffer) {
      return Number(buffer.readZigzag());
    },

    length(value: number) {
      return ProtoBuffer.zigzagLength(value);
    }
  } as Codec<number>,

  sint64: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0n; },
    isDefault(value: bigint) { return value === 0n; },
    encode(value: bigint, buffer: ProtoBuffer) {
      buffer.writeZigzag(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readZigzag();
    },

    length(value: bigint) {
      return ProtoBuffer.zigzagLength(value);
    }
  } as Codec<bigint>,

  fixed32: {
    get wiretype() { return WireType.I32; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeFixed32(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readFixed32();
    },

    length(_value: number) {
      return 4;
    }
  } as Codec<number>,

  fixed64: {
    get wiretype() { return WireType.I64; },
    get default() { return 0n; },
    isDefault(value: bigint) { return value === 0n; },
    encode(value: bigint, buffer: ProtoBuffer) {
      buffer.writeFixed64(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readFixed64();
    },

    length(_value: bigint) {
      return 8;
    }
  } as Codec<bigint>,

  sfixed32: {
    get wiretype() { return WireType.I32; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeSfixed32(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readSfixed32();
    },

    length(_value: number) {
      return 4;
    }
  } as Codec<number>,

  sfixed64: {
    get wiretype() { return WireType.I64; },
    get default() { return 0n; },
    isDefault(value: bigint) { return value === 0n; },
    encode(value: bigint, buffer: ProtoBuffer) {
      buffer.writeSfixed64(value);
    },

    decode(buffer: ProtoBuffer) {
      return buffer.readSfixed64();
    },

    length(_value: bigint) {
      return 8;
    }
  } as Codec<bigint>,

  enum: {
    get wiretype() { return WireType.Varint; },
    get default() { return 0; },
    isDefault(value: number) { return value === 0; },
    encode(value: number, buffer: ProtoBuffer) {
      buffer.writeVarint(value);
    },

    decode(buffer: ProtoBuffer) {
      return Number(buffer.readVarint());
    },

    length(value: number) {
      return ProtoBuffer.varintLength(value);
    }
  } as Codec<number>,

  string: {
    get wiretype() { return WireType.Len; },
    get default() { return ''; },
    isDefault(value: string) { return value === ''; },
    encode(value: string, buffer: ProtoBuffer) {
      const bytes = new TextEncoder().encode(value);
      return codec.bytes.encode(bytes, buffer);
    },

    decode(buffer: ProtoBuffer) {
      const bytes = codec.bytes.decode(buffer);
      return new TextDecoder().decode(Bytes.getUint8Array(bytes));
    },

    length(value: string) {
      return codec.bytes.length(new TextEncoder().encode(value));
    }
  } as Codec<string>,

  bytes: {
    get wiretype() { return WireType.Len; },
    get default() { return new Uint8Array(0); },
    isDefault(value: Uint8Array) { return value.length === 0; },
    encode(value: Uint8Array, buffer: ProtoBuffer) {
      if (value.length > 0xffffffff)
        throw new EncodeError(`Bytes are too long: ${value.length} bytes, max is ${0xffffffff} (32 bits)`);
      buffer.writeVarint(value.length);
      buffer.writeBytes(value);
    },

    decode(buffer: ProtoBuffer) {
      const length = Number(buffer.readVarint());
      return buffer.readBytes(length);
    },

    length(value: Uint8Array) {
      return ProtoBuffer.varintLength(value.length) + value.length;
    }
  } as Codec<Uint8Array | Bytes>,

  submessage: <T extends MessageFields>(fields: T): Codec<v.infer<T>> => {
    const msg = new MessageValidator(fields);

    return {
      get wiretype() { return WireType.Len; },
      get default() {
        const result: any = {};
        for (const key in fields) {
          result[key] = fields[key]!.codec.default;
        }
        return result;
      },
      isDefault(value: v.infer<T>) {
        for (const key in fields) {
          if (!fields[key]!.codec.isDefault(value[key])) {
            return false;
          }
        }
        return true;
      },
      encode(value: v.infer<T>, buffer: ProtoBuffer) {
        const length = msg.length(value);
        buffer.writeVarint(length);
        msg.encode(value, buffer);
      },

      decode(buffer: ProtoBuffer): v.infer<T> {
        const length = Number(buffer.readVarint());
        return msg.decode(buffer.slice(length)) as any;
      },

      length(value: v.infer<T>): number {
        const length = msg.length(value);
        return ProtoBuffer.varintLength(length) + length;
      }
    };
  },
};

type CodecMap = typeof codec;

export type Schemas =
  & {
      [K in Exclude<keyof CodecMap, 'submessage' | 'enum'>]: CodecMap[K] extends Codec<infer T>
        ? (index: number) => FieldSchema<T, K>
        : never;
    }
  & {
      enum: <T extends number>(index: number) => FieldSchema<T, 'enum'>;
      submessage: <T extends MessageFields>(index: number, fields: T) => FieldSchema<v.infer<T>, 'submessage'>;
    };

export type RepeatedSchemas =
  & {
      [K in Exclude<keyof CodecMap, 'submessage' | 'enum'>]: CodecMap[K] extends Codec<infer T>
        ? (index: number) => FieldSchema<T[], K>
        : never;
    }
  & {
      enum: <T extends number>(index: number) => FieldSchema<T[], 'enum'>;
      submessage: <T extends MessageFields>(index: number, fields: T) => FieldSchema<v.infer<T>[], 'submessage'>;
    };

const fieldSchemas = Object.fromEntries(Object.entries(codec).map(([key, codec_]) => [
  key,
  (index: number, ...args: any[]): FieldSchema<any, string> => {
    const codec: Codec<any> = typeof codec_ === 'function' ? (codec_ as any)(...args) : codec_;
    return {
      type: key,
      index,
      repeated: Repeatedness.None,
      codec,
      wiretype: codec.wiretype,
      length: (value) => codec.length(value),
    }
  }
])) as Schemas;

export const v = {
  message: <T extends MessageFields>(fields: T) => new MessageValidator<T>(fields),
  ...fieldSchemas,
  repeated: {
    // NOTE: it's easiest to just ignore the TypeScript bits and pretend everything is correct
    ...Object.fromEntries(
      Object.entries(fieldSchemas).map(([key, fn]) => [
        key,
        (index: number, ...args: any[]) => Object.assign((fn as any)(index, ...args) as any, { repeated: Repeatedness.Default }),
      ]),
    ) as unknown as RepeatedSchemas,
    expanded: Object.fromEntries(
      Object.entries(fieldSchemas).map(([key, fn]) => [
        key,
        (index: number, ...args: any[]) => Object.assign((fn as any)(index, ...args) as any, { repeated: Repeatedness.Expanded }),
      ]),
    ) as unknown as Omit<RepeatedSchemas, 'bytes' | 'string' | 'submessage'>,
  },
};

// `infer` helper for type inference
export namespace v {
  export type infer<T> = Infer<T>;

  type Infer<T> =
    T extends MessageValidator<infer U>
    ? { [K in keyof U]?: Infer<U[K]> }
    : T extends MessageFields
    ? { [K in keyof T]?: Infer<T[K]> }
    : T extends FieldSchema<infer U, any>
    ? U
    : never;
}

function pushValue(obj: any, key: PropertyKey, value: any) {
  if (obj[key]) {
    if (!Array.isArray(obj[key]))
      obj[key] = [obj[key]];
    obj[key].push(value);
  }
  else
    obj[key] = value;
}

function getEncodeMode(schema: FieldSchema<any, any>) {
  switch (schema.repeated) {
    case Repeatedness.None:
      return EncodeMode.Single;
    case Repeatedness.Default:
      return schema.codec.wiretype === WireType.Len ? EncodeMode.Expanded : EncodeMode.Packed;
    case Repeatedness.Expanded:
      return EncodeMode.Expanded;
  }
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
