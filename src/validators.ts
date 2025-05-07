const UnknownField = Symbol('UnknownField');

export interface Validator {
  type: string;
}

export interface MessageValidator extends Validator {
  type: 'message';
  fields: Record<string, Validator>;
}

export interface FieldValidator<T, S extends string> extends Validator {
  type: S;
  index: number;
  name: PropertyKey;
  repeated: Repeatedness;
  encode: (value: T, buffer: Uint8Array, offset: number) => void;
  decode: (buffer: Uint8Array, offset: number) => T;
}

export enum Repeatedness {
  None = 0,
  Expanded = 1,
  Packed = 2,
}

export function message(fields: Record<string, Validator>): MessageValidator {
  throw new Error('Not yet implemented');
}

export function float(index: number): FieldValidator<number, 'float'> {
  return {
    type: 'float',
    index,
    name: UnknownField,
    repeated: Repeatedness.None,
    encode: (value: number, buffer: Uint8Array, offset: number) => {
      if (buffer.length - offset < 4) throw new Error('Buffer too small');
      const view = new DataView(buffer.buffer);
      view.setFloat32(offset, value);
    },
    decode: (buffer: Uint8Array, offset: number) => {
      if (buffer.length - offset < 4) throw new Error('Buffer too small');
      const view = new DataView(buffer.buffer);
      return view.getFloat32(offset);
    },
  };
}
