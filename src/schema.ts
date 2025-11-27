import { codecs, transformCodec, type TransformParameters } from './codecs';
import type { Codec, CodecFactory, CodecType } from './codecs';
import { InferType, IVariants, Repeatedness, ToVariant, type Infer } from './commons';
import { IMessage, Message, type MessageFields } from './message';
import { ProtoBuffer, WireType } from './protobuffer';

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

export interface FieldSchema<T, S extends string> extends Validator<T, S>, Omit<SchemaParameters<T, S>, 'type'> {
  readonly wiretype: WireType
}

export interface FieldSchemaWithTransform<In, S extends string> extends FieldSchema<In, S> {
  transform: <Out>(params: TransformParameters<In, Out>) => FieldSchemaWithTransform<KeepUndefined<In, Out>, S>;
  required(): FieldSchemaWithTransform<Defined<In>, S>;
}

type Defined<T> = Exclude<T, undefined>;
type KeepUndefined<In, Out> = In extends undefined ? Out | undefined : Out;

export type Schemas = SimpleSchemas & GenericSchemas;
export type RepeatedSchemas = SimpleRepeatedSchemas & GenericRepeatedSchemas;

type SimpleSchemaTypes = 'bool' | 'int32' | 'int64' | 'uint32' | 'uint64' | 'sint32' | 'sint64' | 'fixed32' | 'fixed64' | 'sfixed32' | 'sfixed64' | 'float' | 'double' | 'string' | 'bytes';
type SimpleSchemas = { [K in SimpleSchemaTypes]: (index: number) => FieldSchemaWithTransform<CodecType[K] | undefined, K> };
type SimpleRepeatedSchemas = { [K in SimpleSchemaTypes]: (index: number) => FieldSchemaWithTransform<CodecType[K][] | undefined, K> };

interface GenericSchemas {
  literal: <T extends string>(index: number, value: T) => FieldSchemaWithTransform<T, 'literal'>;
  enum: <T extends number>(index: number) => FieldSchemaWithTransform<T | undefined, 'enum'>;
  submessage<T extends MessageFields>(index: number, fields: T): FieldSchemaWithTransform<Infer<T> | undefined, 'submessage'>;
  submessage<T extends MessageFields, U>(index: number, msg: IMessage<T, U>): FieldSchemaWithTransform<U | undefined, 'submessage'>;
  json: <T extends {}>(index: number) => FieldSchemaWithTransform<Partial<T> | undefined, 'json'>;
};

interface GenericRepeatedSchemas {
  enum: <T extends number>(index: number) => FieldSchemaWithTransform<T[] | undefined, 'enum'>;
  submessage<T extends MessageFields>(index: number, fields: T): FieldSchemaWithTransform<v.infer<T>[] | undefined, 'submessage'>;
  submessage<T extends MessageFields, U>(index: number, msg: IMessage<T, U>): FieldSchemaWithTransform<U[] | undefined, 'submessage'>;
  json: <T extends {}>(index: number) => FieldSchemaWithTransform<Partial<T>[] | undefined, 'json'>;
};

interface SchemaParameters<T, S extends string> {
  type: S;
  index: number;
  codec: Codec<T>;
  _repeated?: Repeatedness;
  _required?: boolean;
}

function createSchema<T, S extends string>({
  type,
  codec,
  index,
  _repeated = Repeatedness.None,
  _required = false,
}: SchemaParameters<T, S>): FieldSchema<T, S> {
  return {
    type,
    codec,
    index,
    _repeated,
    _required,
    get wiretype() { return codec.wiretype; },
    length: (value) => codec.length(value),
  };
}

function getSchemaFactory<T1, Args extends any[]>(
  type: string,
  codec_: Codec<T1> | CodecFactory<T1, Args>,
): (index: number, ...args: Args) => FieldSchemaWithTransform<T1, string> {
  return (index: number, ...args: Args) => {
    const codec: Codec<T1> = typeof codec_ === 'function' ? (codec_ as any)(...args) : codec_;
    return addTransform(createSchema({ type, index, codec }));
  };
};

function addTransform<T, S extends string>(schema: FieldSchema<T, S>): FieldSchemaWithTransform<T, S> {
  return Object.assign(schema, {
    transform: (<T2>(sub: TransformParameters<T, T2>) =>
      addTransform(createSchema({ ...schema, codec: transformCodec(schema.codec, sub) }))) as any,
    required: () => addTransform(createSchema({ ...schema, _required: true })) as any,
  });
}

export const fieldSchemas = Object.fromEntries(
  Object.entries(codecs).map(([key, codec]) => [key, getSchemaFactory(key, codec as any)])
) as unknown as Schemas;

export const v = {
  message: <T extends MessageFields>(fields: T) => new Message<T>(fields),
  /** Variants are similar to [protobuf's `Any`](https://protobuf.dev/programming-guides/proto3/#any)
   * except instead of a `type_url` string, it uses a numeric enum. The `0` property is used as the
   * default variant.
   *
   * *Note:* Variants are achieved through a `Message.transform` call.
   */
  variants: <Prop extends string, T extends Record<string | number, IMessage<any, any>>>(typeProp: Prop, variants: T) => {
    const subcodecs = Object.fromEntries(
      Object.entries(variants).map(([key, value]) => [key, codecs.submessage(value)]),
    ) as Record<keyof T, Codec<ToVariant<Prop, Exclude<keyof T, symbol>, T[Exclude<keyof T, symbol>]>>>;
    return Object.assign(
      new Message({
        typename: v.string(1),
        typeid: v.int32(2),
        value: v.bytes(3),
      }).transform<Infer<IVariants<Prop, T>>>({
        encode: (value) => {
          const ty = value[typeProp];
          const codec = subcodecs[ty];
          if (!codec)
            throw new Error(`No codec found for variant ${ty}`);

          const buf = new ProtoBuffer();
          codec.encode(value, buf);

          return {
            value: buf.toShrunk().bytes(),
            typename: typeof ty === 'string' ? ty : undefined,
            typeid: typeof ty === 'number' ? ty : undefined,
          };
        },
        decode: (value) => {
          const ty = value.typename ?? value.typeid ?? 0;
          const codec = subcodecs[ty];
          if (!codec)
            throw new Error(`No codec found for variant ${ty}`);
          return {
            [typeProp]: ty,
            ...codec.decode(new ProtoBuffer(value.value)),
          };
        },
        get default() {
          return {
            [typeProp]: 0,
            ...subcodecs[0]!.default,
          };
        },
      }),
      { variants, prop: typeProp },
    ) satisfies IVariants<Prop, T>;
  },
  ...fieldSchemas,
  repeated: {
    // NOTE: it's easiest to just ignore the TypeScript bits and pretend everything is correct
    ...Object.fromEntries(
      Object.entries(fieldSchemas).map(([key, fn]) => [
        key,
        (index: number, ...args: any[]) => Object.assign((fn as any)(index, ...args) as any, { _repeated: Repeatedness.Default }),
      ]),
    ) as unknown as RepeatedSchemas,
    expanded: Object.fromEntries(
      Object.entries(fieldSchemas).map(([key, fn]) => [
        key,
        (index: number, ...args: any[]) => Object.assign((fn as any)(index, ...args) as any, { _repeated: Repeatedness.Expanded }),
      ]),
    ) as unknown as Omit<RepeatedSchemas, 'bytes' | 'string' | 'submessage'>,
  },
};

// `infer` helper for type inference
export namespace v {
  export type infer<T> = Infer<T>;
}
