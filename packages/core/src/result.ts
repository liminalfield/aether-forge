/**
 * A value or a failure, returned rather than thrown.
 *
 * Core describes boundaries that other packages implement. Something that can
 * fail across such a boundary should say so in its type, so that a caller
 * cannot forget to consider it. Throwing inside an implementation is fine; a
 * failure crossing the boundary is a value.
 */

export type Result<Value, Failure> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly failure: Failure };

/** A successful result. */
export function ok<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

/** A failed result. */
export function failed<Failure>(failure: Failure): Result<never, Failure> {
  return { ok: false, failure };
}
