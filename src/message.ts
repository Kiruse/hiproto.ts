import { InferType, type Infer, Repeatedness } from './commons';
import { ProtoBuffer } from './protobuffer';
import { DecodeError } from './errors';
import { WireType } from './protobuffer';
import type { FieldSchema, Validator } from './schema';
import { TransformParameters } from './codecs';

export type MessageFields = Record<PropertyKey, FieldSchema<any, any>>;

export type UnknownFieldsProp = {
  [UnknownFields]?: Record<number, { index: number, wiretype: WireType, value: any }>;
}

export const UnknownFields = Symbol('UnknownFields');

enum EncodeMode {
  Single,
  Packed,
  Expanded,
}

export interface IMessage<T extends MessageFields, U> extends Validator<U, 'message'> {
  readonly [InferType]: U;
  readonly type: 'message';
  readonly fields: Readonly<T>;

  encode(value: U, buffer?: ProtoBuffer): ProtoBuffer;
  decode(buffer: ProtoBuffer | Uint8Array): U & UnknownFieldsProp;
  length(value: U): number;
  transform<V extends {}>(params: TransformParameters<U, V>): IMessage<T, V>;
}

export class Message<T extends MessageFields> implements IMessage<T, Infer<T>> {
  readonly [InferType]: Infer<T> = undefined as any;
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

  encode(value: Infer<T>, buffer = new ProtoBuffer()) {
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
          if (!Array.isArray(val[field]) || val[field].length === 0) break;
          const byteLength = val[field].reduce((acc: number, item: any) => acc + schema.codec.length(item), 0);
          buffer.writeFieldHeader(schema.index, WireType.Len);
          buffer.writeVarint(byteLength);
          buffer.ensureCapacity(byteLength);
          for (const item of val[field]) {
            schema.codec.encode(item, buffer);
          }
          break;
        }
        case EncodeMode.Expanded: {
          if (!Array.isArray(val[field]) || val[field].length === 0) break;
          for (const item of val[field]) {
            buffer.writeFieldHeader(schema.index, schema.wiretype);
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

  decode(buffer: ProtoBuffer | Uint8Array): Infer<T> & UnknownFieldsProp {
    if (buffer instanceof Uint8Array) buffer = new ProtoBuffer(buffer);

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
        if (schema._repeated === Repeatedness.None) {
          payload[field] = schema.codec.default;
        } else {
          payload[field] = [];
        }
        continue;
      }

      if (schema._repeated === Repeatedness.None) {
        if (Array.isArray(payload[field]))
          throw new DecodeError(`Field ${field} is repeated, but schema expects a single value`);
      } else {
        if (!Array.isArray(payload[field]))
          payload[field] = [payload[field]];
      }

      if (schema._required && !payload[field]) {
        if (schema._repeated === Repeatedness.None) {
          payload[field] = schema.codec.default;
        } else {
          payload[field] = [];
        }
      }
    }

    return payload;
  }

  length(value: Infer<T>): number {
    let length = 0;
    for (const [key, schema] of Object.entries(this.fields) as [keyof T, FieldSchema<any, string>][] ) {
      const encodeMode = getEncodeMode(schema);
      switch (encodeMode) {
        case EncodeMode.Single:
          // extra 1 byte for the field header
          const v = value[key as keyof Infer<T>];
          if (!v || schema.codec.isDefault(v)) break;
          length += 1 + schema.length(v);
          break;
        case EncodeMode.Packed: {
          const values: unknown = value[key as keyof Infer<T>] ?? [];
          if (!Array.isArray(values))
            throw new DecodeError(`Field ${key.toString()} is packed, but value is not an array`);
          if (values.length === 0) break;
          // extra 1 byte for the field header + byte length, packed
          length += 2;
          for (const item of values) {
            length += schema.length(item);
          }
          break;
        }
        case EncodeMode.Expanded: {
          const values: unknown = value[key as keyof Infer<T>] ?? [];
          if (!Array.isArray(values))
            throw new DecodeError(`Field ${key.toString()} is expanded, but value is not an array`);
          if (values.length === 0) break;
          for (const item of values) {
            // extra 1 byte for the field header, for each item
            length += 1 + schema.length(item);
          }
          break;
        }
      }
    }
    return length;
  }

  transform<V extends {}>(params: TransformParameters<Infer<T>, V>): IMessage<T, V> {
    return new MessageTransformer<T, V>(this, params);
  }
}

class MessageTransformer<T extends MessageFields, U extends {}> implements IMessage<T, U> {
  readonly [InferType]: U = undefined as any;
  readonly type = 'message';

  constructor(
    private readonly _parent: IMessage<T, any>,
    private readonly _params: TransformParameters<any, U>,
  ) {}

  encode(value: U, buffer = new ProtoBuffer()) {
    return this._parent.encode(this._params.encode(value), buffer);
  }

  decode(buffer: ProtoBuffer | Uint8Array): U & UnknownFieldsProp {
    const payload = this._parent.decode(buffer);
    return Object.assign(this._params.decode(payload), { [UnknownFields]: payload[UnknownFields] });
  }

  length(value: U): number {
    return this._parent.length(this._params.encode(value));
  }

  transform<V extends {}>(params: TransformParameters<U, V>): IMessage<T, V> {
    return new MessageTransformer<T, V>(this, params);
  }

  get fields() { return this._parent.fields; }
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
  switch (schema._repeated) {
    case Repeatedness.None:
      return EncodeMode.Single;
    case Repeatedness.Default:
      return schema.codec.wiretype === WireType.Len ? EncodeMode.Expanded : EncodeMode.Packed;
    case Repeatedness.Expanded:
      return EncodeMode.Expanded;
  }
}
