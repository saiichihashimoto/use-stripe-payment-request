import { isFunction } from "lodash/fp";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-use";

import type {
  PaymentRequest,
  PaymentRequestCompleteStatus,
  PaymentRequestOptions,
  PaymentRequestPaymentMethodEvent,
  PaymentRequestShippingAddress,
  PaymentRequestShippingAddressEvent,
  PaymentRequestShippingOption,
  PaymentRequestShippingOptionEvent,
  PaymentRequestSourceEvent,
  PaymentRequestTokenEvent,
  PaymentRequestUpdateDetails,
  PaymentRequestUpdateDetailsStatus,
  Stripe,
} from "@stripe/stripe-js";
import type { SetStateAction } from "react";

/**
 * @link https://stripe.com/docs/js/payment_request/create
 *
 * @example
 *
 * const [paymentRequest, { canMakePayment, setOpen }] = usePaymentRequest(stripe, { ... });
 *
 * return !canMakePayment
 *   ? null
 *   : <button onClick={() => setOpen(true)}>Open Apple/Google Pay</button>;
 */
export const usePaymentRequest = (
  stripe: Stripe | undefined | null,
  {
    country,
    currency,
    disableWallets,
    displayItems,
    requestPayerEmail,
    requestPayerName,
    requestPayerPhone,
    requestShipping,
    shippingOptions,
    total,
  }: PaymentRequestOptions
) => {
  const paymentRequest = useMemo(
    () =>
      stripe?.paymentRequest({
        // currency, displayItems, shippingOptions, & total can be updated and we don't want to trigger a new payment request
        // so we put some dummy values here and update them wherever updates are allowed
        country,
        currency: "usd",
        disableWallets,
        displayItems: [],
        requestPayerEmail,
        requestPayerName,
        requestPayerPhone,
        requestShipping,
        shippingOptions: [],
        total: {
          amount: 0,
          label: "Total",
          pending: true,
        },
      }),
    [
      country,
      disableWallets,
      requestPayerEmail,
      requestPayerName,
      requestPayerPhone,
      requestShipping,
      stripe,
    ]
  );

  const canMakePayment = useAsync(
    async () => (await paymentRequest?.canMakePayment()) ?? undefined,
    [paymentRequest]
  );

  const [open, setOpenRaw] = useState(false);
  const setOpen = useCallback(
    (openAction: SetStateAction<boolean>) => {
      const newOpen = isFunction(openAction) ? openAction(open) : openAction;
      if (
        !canMakePayment.value ||
        newOpen === open ||
        newOpen === Boolean(paymentRequest?.isShowing())
      ) {
        return;
      }

      setOpenRaw(newOpen);

      if (newOpen) {
        paymentRequest?.update({
          currency,
          displayItems,
          shippingOptions,
          total,
        });

        paymentRequest?.show();
      } else {
        void paymentRequest?.abort?.();
      }
    },
    [
      canMakePayment,
      currency,
      displayItems,
      open,
      paymentRequest,
      shippingOptions,
      total,
    ]
  );

  useEffect(() => {
    const handler = () => setOpenRaw(false);

    paymentRequest?.on("cancel", handler);

    return () => void paymentRequest?.off("cancel", handler);
  }, [paymentRequest, setOpenRaw]);

  return [
    paymentRequest,
    {
      canMakePayment,
      open,
      setOpen,
    },
  ] as const;
};

type MaybePromise<T> = T | Promise<T>;

interface PaymentEvents {
  paymentmethod: PaymentRequestPaymentMethodEvent;
  source: PaymentRequestSourceEvent;
  token: PaymentRequestTokenEvent;
}

interface ShippingEvents {
  shippingaddresschange: PaymentRequestShippingAddressEvent;
  shippingoptionchange: PaymentRequestShippingOptionEvent;
}

interface Events extends PaymentEvents, ShippingEvents {}

type PaymentValues = {
  [Key in keyof PaymentEvents]: Omit<PaymentEvents[Key], "complete">;
};

type PaymentStatuses = {
  [Key in keyof PaymentEvents]: PaymentRequestCompleteStatus;
};

type ShippingStatuses = {
  [Key in keyof ShippingEvents]: PaymentRequestUpdateDetailsStatus;
};

interface Statuses extends PaymentStatuses, ShippingStatuses {}

/**
 * Main hook for all paymentRequest events. Won't be used directly: we'll be using the named hooks instead ie usePaymentRequestShippingAddress
 *
 * @link https://stripe.com/docs/js/payment_request/events
 */
const usePaymentRequestEventHandler = <EventName extends keyof Events>(
  eventName: EventName,
  paymentRequest: PaymentRequest | undefined,
  getCallback: (
    event: Events[EventName]
  ) => (status: Statuses[EventName]) => void,
  onEvent?: (event: Events[EventName]) => MaybePromise<Statuses[EventName]>
) =>
  useEffect(() => {
    if (!onEvent) {
      return () => {};
    }

    const handler = async (event: Events[EventName]) => {
      const callback = getCallback(event);

      callback(
        await Promise.any([
          onEvent(event),
          new Promise<Statuses[EventName]>(
            (resolve) => void setTimeout(() => resolve("fail"), 2000)
          ),
        ])
      );
    };

    // @ts-expect-error -- FIXME paymentRequest.on is a function overload and it won't detect that any EventName & Event pair fits https://github.com/microsoft/TypeScript/issues/14107
    paymentRequest?.on(eventName, handler);

    // @ts-expect-error -- FIXME paymentRequest.off is a function overload and it won't detect that any EventName & Event pair fits https://github.com/microsoft/TypeScript/issues/14107
    return () => void paymentRequest?.off(eventName, handler);
  }, [eventName, getCallback, onEvent, paymentRequest]);

const usePaymentRequestShippingEvent = <EventName extends keyof ShippingEvents>(
  eventName: EventName,
  paymentRequest: PaymentRequest | undefined,
  {
    displayItems,
    shippingOptions,
    total,
  }: Omit<PaymentRequestUpdateDetails, "status">,
  onShippingResponseChange?:
    | ((
        event: ShippingEvents[EventName]
      ) => MaybePromise<PaymentRequestUpdateDetailsStatus>)
    | undefined
) => {
  const [event, setEvent] = useState<ShippingEvents[EventName]>();
  const [status, setStatus] = useState<PaymentRequestUpdateDetailsStatus>();

  useEffect(() => {
    if (!event || !status) {
      return;
    }

    setEvent(undefined);
    setStatus(undefined);

    // HACK I would much prefer to call this in getShippingCallback, but I need to give one render cycle for displayItems/shippingOptions/total to change
    event.updateWith({
      status,
      ...(status === "success" && {
        displayItems,
        shippingOptions,
        total,
      }),
    });
  }, [displayItems, event, shippingOptions, status, total]);

  const getShippingCallback = useCallback(
    (event: ShippingEvents[EventName]) =>
      (status: PaymentRequestUpdateDetailsStatus) => {
        setEvent(event);
        setStatus(status);
      },
    []
  );

  usePaymentRequestEventHandler(
    eventName,
    paymentRequest,
    getShippingCallback,
    onShippingResponseChange
  );
};

/**
 * @link https://stripe.com/docs/js/payment_request/events/on_shipping_address_change
 */
export const usePaymentRequestShippingAddress = (
  paymentRequest: PaymentRequest | undefined,
  options: Omit<PaymentRequestUpdateDetails, "status">,
  onShippingAddressChangeRaw?: (
    shippingAddress: PaymentRequestShippingAddress
  ) => MaybePromise<PaymentRequestUpdateDetailsStatus>
) => {
  const onShippingAddressChange = useMemo(
    () =>
      onShippingAddressChangeRaw &&
      (({ shippingAddress }: PaymentRequestShippingAddressEvent) =>
        onShippingAddressChangeRaw(shippingAddress)),
    [onShippingAddressChangeRaw]
  );

  usePaymentRequestShippingEvent(
    "shippingaddresschange",
    paymentRequest,
    options,
    onShippingAddressChange
  );
};

/**
 * @link https://stripe.com/docs/js/payment_request/events/on_shipping_option_change
 */

export const usePaymentRequestShippingOption = (
  paymentRequest: PaymentRequest | undefined,
  options: Omit<PaymentRequestUpdateDetails, "status">,
  onShippingOptionChangeRaw?: (
    shippingOption: PaymentRequestShippingOption
  ) => MaybePromise<PaymentRequestUpdateDetailsStatus>
) => {
  const onShippingOptionChange = useMemo(
    () =>
      onShippingOptionChangeRaw &&
      (({ shippingOption }: PaymentRequestShippingOptionEvent) =>
        onShippingOptionChangeRaw(shippingOption)),
    [onShippingOptionChangeRaw]
  );

  usePaymentRequestShippingEvent(
    "shippingoptionchange",
    paymentRequest,
    options,
    onShippingOptionChange
  );
};

const getPaymentCallback = <EventName extends keyof PaymentEvents>({
  complete,
}: PaymentEvents[EventName]) => complete;

const usePaymentRequestPaymentEvent = <EventName extends keyof PaymentEvents>(
  eventName: EventName,
  paymentRequest: PaymentRequest | undefined,
  onPaymentResponseChangeRaw?: (
    value: Omit<PaymentValues[EventName], "complete">
  ) => MaybePromise<PaymentRequestCompleteStatus>
) => {
  const onPaymentResponseChange = useMemo(
    () =>
      onPaymentResponseChangeRaw &&
      (async ({ complete, ...value }: Events[EventName]) =>
        onPaymentResponseChangeRaw(value)),
    [onPaymentResponseChangeRaw]
  );

  usePaymentRequestEventHandler(
    eventName,
    paymentRequest,
    getPaymentCallback,
    onPaymentResponseChange
  );
};

/**
 * @link https://stripe.com/docs/js/payment_request/events/on_paymentmethod
 */
export const usePaymentRequestPaymentMethod = (
  paymentRequest: PaymentRequest | undefined,
  onPaymentMethodChange?: (
    paymentResponse: Omit<PaymentRequestPaymentMethodEvent, "complete">
  ) => MaybePromise<PaymentRequestCompleteStatus>
) =>
  usePaymentRequestPaymentEvent(
    "paymentmethod",
    paymentRequest,
    onPaymentMethodChange
  );

/**
 * @link https://stripe.com/docs/js/payment_request/events/on_source
 */

export const usePaymentRequestSource = (
  paymentRequest: PaymentRequest | undefined,
  onSourceChange?: (
    paymentResponse: Omit<PaymentRequestSourceEvent, "complete">
  ) => MaybePromise<PaymentRequestCompleteStatus>
) => usePaymentRequestPaymentEvent("source", paymentRequest, onSourceChange);

/**
 * @link https://stripe.com/docs/js/payment_request/events/on_token
 */

export const usePaymentRequestToken = (
  paymentRequest: PaymentRequest | undefined,
  onTokenChange?: (
    paymentResponse: Omit<PaymentRequestTokenEvent, "complete">
  ) => MaybePromise<PaymentRequestCompleteStatus>
) => usePaymentRequestPaymentEvent("token", paymentRequest, onTokenChange);
