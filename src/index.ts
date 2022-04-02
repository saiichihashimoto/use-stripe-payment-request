import { isFunction } from "lodash/fp";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsync } from "react-use";

import type { PaymentRequestOptions, Stripe } from "@stripe/stripe-js";
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
