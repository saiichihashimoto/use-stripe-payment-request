import "@stripe/stripe-js";

declare module "@stripe/stripe-js" {
  interface PaymentRequest {
    /** @link https://developer.mozilla.org/en-US/docs/Web/API/PaymentRequest/abort */
    // TODO Remove PaymentRequest type overrides once it's merged into their types https://github.com/stripe/stripe-js/pull/302
    abort?: () => Promise<unknown>;
  }
}
