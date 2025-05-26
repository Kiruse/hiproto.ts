import { InferType, type Infer } from './commons';
import { EncodeError } from './errors';
import { MessageFields, Message, IMessage } from './message';
import { Bytes, ProtoBuffer, WireType } from './protobuffer';

export type CodecMap = typeof codecs;
export type CodecFactory<T, Args extends any[]> = (index: number, ...args: Args) => Codec<T>;

export type CodecType = {
  [K in keyof CodecMap]: CodecMap[K] extends Codec<infer T> ? T : never;
};

/** Algorithm for encoding & decoding of individual values. */
export interface Codec<In> {
  get wiretype(): WireType;
  get default(): In;
  encode(value: In, buffer: ProtoBuffer): void;
  decode(buffer: ProtoBuffer): In;
  length(value: In): number;
  isDefault(value: In): boolean;
}

export interface TransformParameters<Base, Transformed> {
  get default(): Transformed;
  encode: (value: Transformed) => Base;
  decode: (value: Base) => Transformed;
}

export function transformCodec<T1, T2>(codec: Codec<T1>, sub: TransformParameters<T1, T2>): Codec<T2> {
  return {
    get wiretype() { return codec.wiretype; },
    get default() { return sub.default; },
    encode(value: T2, buffer: ProtoBuffer) {
      codec.encode(sub.encode(value), buffer);
    },
    decode(buffer: ProtoBuffer): T2 {
      return sub.decode(codec.decode(buffer));
    },
    length(value: T2) {
      return codec.length(sub.encode(value));
    },
    isDefault(value: T2) {
      return codec.isDefault(sub.encode(value));
    }
  };
}

export const codecs = {
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
      return codecs.bytes.encode(bytes, buffer);
    },

    decode(buffer: ProtoBuffer) {
      const bytes = codecs.bytes.decode(buffer);
      return new TextDecoder().decode(Bytes.getUint8Array(bytes));
    },

    length(value: string) {
      return codecs.bytes.length(new TextEncoder().encode(value));
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

  submessage: <T extends MessageFields, U = Infer<T>>(fields: T | IMessage<T, U>): Codec<U> => {
    const isIMessage = (value: any): value is IMessage<T, U> => InferType in value && value['type'] === 'message' && 'fields' in value;
    const msg: IMessage<T, U> = isIMessage(fields) ? fields : new Message<T>(fields) as IMessage<T, U>;
    const fields_ = msg.fields;

    return {
      get wiretype() { return WireType.Len; },
      get default() {
        const result: any = {};
        for (const key in fields_) {
          result[key] = fields_[key]!.codec.default;
        }
        return result;
      },

      isDefault(value: U) {
        for (const key in fields_) {
          if (!fields_[key]!.codec.isDefault((value as any)[key])) {
            return false;
          }
        }
        return true;
      },

      encode(value: U, buffer: ProtoBuffer) {
        const length = msg.length(value);
        buffer.writeVarint(length);
        msg.encode(value, buffer);
      },

      decode(buffer: ProtoBuffer): U {
        const length = Number(buffer.readVarint());
        return msg.decode(buffer.slice(length)) as U;
      },

      length(value: U): number {
        const length = msg.length(value);
        return ProtoBuffer.varintLength(length) + length;
      }
    };
  },

  json: <T extends {}>(encoding: 'raw' | 'base64' | 'hex' = 'base64'): Codec<Partial<T>> => {
    const encode = (value: Partial<T>) => {
      const json = JSON.stringify(value);
      switch (encoding) {
        case 'raw': return json;
        case 'base64': return toBase64(new TextEncoder().encode(json));
        case 'hex': return toHex(new TextEncoder().encode(json));
      }
    };

    const decode = (value: string) => {
      switch (encoding) {
        case 'raw': return JSON.parse(value);
        case 'base64': return JSON.parse(new TextDecoder().decode(fromBase64(value)));
        case 'hex': return JSON.parse(new TextDecoder().decode(fromHex(value)));
      }
    };

    return {
      get wiretype() { return WireType.Len; },
      get default() { return {}; },
      isDefault(value: T) { return Object.keys(value).length === 0; },

      encode(value: T, buffer: ProtoBuffer) {
        return codecs.string.encode(encode(value), buffer);
      },

      decode(buffer: ProtoBuffer) {
        return decode(codecs.string.decode(buffer));
      },

      length(value: T) {
        return codecs.string.length(encode(value));
      },
    }
  },
};

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(str: string): Uint8Array {
  if (str.length % 2 !== 0)
    throw new Error('Hex string must have an even number of characters');
  const matches = str.match(/[0-9a-fA-F]{2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}
