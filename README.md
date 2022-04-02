# use-stripe-payment-request

![NPM](https://img.shields.io/npm/v/use-stripe-payment-request)
![NPM](https://img.shields.io/npm/dw/use-stripe-payment-request)
![Typescript](https://img.shields.io/npm/types/use-stripe-payment-request)

React Hooks for [Stripe's Payment Request](https://stripe.com/docs/js/payment_request/create) and [Payment Request Events](https://stripe.com/docs/js/payment_request/events). Replaces the need for the `PaymentRequestButtonElement` but ultimately has all [the same requirements](https://stripe.com/docs/stripe-js/elements/payment-request-button?html-or-react=react).

## Getting Started

```bash
npm install use-stripe-payment-request @stripe/stripe-js
```

```tsx
import type { PaymentRequestOptions } from "@stripe/stripe-js";
import { useMemo } from "react";
import {
    usePaymentRequest,
    usePaymentRequestPaymentMethod,
    usePaymentRequestShippingAddress,
} from "use-stripe-payment-request";

// In a component

const stripe = useStripe();

const [shippingCosts, setShippingCosts] = useState();

const options: PaymentRequestOptions = useMemo(() => ({
    country: "US",
    displayOptions: [..., getDisplayOption(shippingCosts)],
    requestShipping: true,
    // ...
}), [shippingCosts, ...]);

const [paymentRequest, {
    canMakePayment,
    open,
    setOpen,
}] = usePaymentRequest(stripe, options);

usePaymentRequestShippingAddress(paymentRequest, options, async (shippingAddress) => {
    const result = await someAsyncFn(shippingAddress);

    setShippingCosts(result);

    // You don't need to call `updateWith`.
    // `options` reflects the desired state and `upateWith`
    // gets invoked under the hood once this callback returns
    // a status.
    return "success";
});

usePaymentRequestPaymentMethod(paymentRequest, async ({ paymentMethod }) => {
    const clientSecret = await getTheSecretFromBackend();

    await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod,
    });

    return "success";
});

return !canMakePayment.value
    ? null
    : (
        <button
            disabled={open}
            onClick={() => setOpen(true)}
        >
            Open Apple/Google Pay
        </button>
    );
```

## API

### `usePaymentRequest`

```typescript
usePaymentRequest(
    stripe: Stripe | undefined | null,
    options: PaymentRequestOptions
): [
    PaymentRequest,
    {
        canMakePayment: {
            error?: Error;
            loading: boolean;
            value?: CanMakePaymentResult;
        };
        open: boolean;
        setOpen: Dispatch<SetStateAction<boolean>>;
    }
]
```

### `usePaymentRequestShippingAddress`

https://stripe.com/docs/js/payment_request/events/on_shipping_address_change

```typescript
usePaymentRequestShippingAddress(
    paymentRequest: PaymentRequest | undefined,
    options: Omit<PaymentRequestUpdateDetails, "status">,
    onShippingAddressChange?: (
        shippingAddress: PaymentRequestShippingAddress
    ) => MaybePromise<PaymentRequestUpdateDetailsStatus>
): void
```

### `usePaymentRequestShippingOption`

https://stripe.com/docs/js/payment_request/events/on_shipping_option_change

```typescript
usePaymentRequestShippingOption(
    paymentRequest: PaymentRequest | undefined,
    options: Omit<PaymentRequestUpdateDetails, "status">,
    onShippingOptionChange?: (
        shippingOption: PaymentRequestShippingOption
    ) => MaybePromise<PaymentRequestUpdateDetailsStatus>
): void
```

### `usePaymentRequestPaymentMethod`

https://stripe.com/docs/js/payment_request/events/on_paymentmethod

```typescript
usePaymentRequestPaymentMethod(
    paymentRequest: PaymentRequest | undefined,
    onPaymentMethodChange?: (
        paymentResponse: Omit<PaymentRequestPaymentMethodEvent, "complete">
    ) => MaybePromise<PaymentRequestCompleteStatus>
): void
```

### `usePaymentRequestSource`

https://stripe.com/docs/js/payment_request/events/on_source

```typescript
usePaymentRequestSource(
    paymentRequest: PaymentRequest | undefined,
    onSourceChange?: (
        paymentResponse: Omit<PaymentRequestSourceEvent, "complete">
    ) => MaybePromise<PaymentRequestCompleteStatus>
): void
```

### `usePaymentRequestToken`

https://stripe.com/docs/js/payment_request/events/on_token

```typescript
usePaymentRequestToken(
    paymentRequest: PaymentRequest | undefined,
    onTokenChange?: (
        paymentResponse: Omit<PaymentRequestTokenEvent, "complete">
    ) => MaybePromise<PaymentRequestCompleteStatus>
): void
```
