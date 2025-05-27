import type { Message, MessageFields } from './message';
import type { FieldSchema } from './schema';

export const InferType = '@@hiprotoInferType@@';

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

export type Infer<T> =
  T extends Message<infer U>
  ? { [K in keyof U]?: Infer<U[K]> }
  : T extends MessageFields
  ? { [K in keyof T]?: Infer<T[K]> }
  : T extends FieldSchema<infer U, any>
  ? U
  : never;
