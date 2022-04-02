import EventEmitter from "events";

import { beforeEach, describe, expect, it } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-hooks";

import { usePaymentRequest } from ".";

import type {
  CanMakePaymentResult,
  PaymentRequest,
  PaymentRequestOptions,
  Stripe,
} from "@stripe/stripe-js";

describe("usePaymentRequest", () => {
  let options: PaymentRequestOptions = {
    country: "US",
    currency: "cad",
    displayItems: [{ amount: 75, label: "An Item" }],
    shippingOptions: [
      {
        amount: 25,
        detail: "This is shipping",
        id: "shipping",
        label: "Shipping",
      },
    ],
    total: {
      amount: 100,
      label: "Total",
    },
  };
  let canMakePayment: jest.Mock<Promise<CanMakePaymentResult>, []>;
  let isShowing: jest.Mock<boolean, []>;
  let stripe: Stripe;
  let paymentRequest: PaymentRequest;
  let paymentRequestEmitter: EventEmitter;

  beforeEach(() => {
    canMakePayment = jest.fn(async () => Promise.resolve({}));
    isShowing = jest.fn(() => false);
    (paymentRequestEmitter as EventEmitter | undefined)?.removeAllListeners();
    paymentRequestEmitter = new EventEmitter();

    paymentRequest = {
      abort: jest.fn(),
      canMakePayment,
      isShowing,
      off: jest.fn(paymentRequestEmitter.off.bind(paymentRequestEmitter)),
      on: jest.fn(paymentRequestEmitter.on.bind(paymentRequestEmitter)),
      show: jest.fn(),
      update: jest.fn(),
    } as unknown as PaymentRequest;

    stripe = {
      paymentRequest: jest.fn(() => paymentRequest),
    } as unknown as Stripe;
  });

  it("does nothing with undefined stripe", () => {
    const { result } = renderHook(() => usePaymentRequest(undefined, options));

    expect(result.current).toHaveProperty("0", undefined);
  });

  it("returns paymentRequest", () => {
    const { result } = renderHook(() => usePaymentRequest(stripe, options));

    expect(result.current).toHaveProperty("0", paymentRequest);
    expect(result.current).toHaveProperty("1.canMakePayment", {
      loading: true,
    });
    expect(result.current).toHaveProperty("1.open", false);
    expect(result.current).toHaveProperty("1.setOpen", expect.any(Function));

    expect(stripe.paymentRequest).toHaveBeenLastCalledWith({
      country: "US",
      currency: "usd",
      displayItems: [],
      shippingOptions: [],
      total: {
        amount: 0,
        label: "Total",
        pending: true,
      },
    });
  });

  it("returns canMakePayment", async () => {
    canMakePayment.mockReturnValueOnce(
      Promise.resolve({
        applePay: true,
        googlePay: false,
      })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      usePaymentRequest(stripe, options)
    );

    await waitForNextUpdate();

    expect(result.current).toHaveProperty("1.canMakePayment", {
      loading: false,
      value: {
        applePay: true,
        googlePay: false,
      },
    });
  });

  it("setOpen updates paymentRequest and opens it", async () => {
    canMakePayment.mockReturnValueOnce(
      Promise.resolve({
        applePay: true,
        googlePay: false,
      })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      usePaymentRequest(stripe, options)
    );

    await waitForNextUpdate();

    act(() => result.current[1].setOpen(true));
    isShowing.mockReturnValue(true);

    expect(result.current).toHaveProperty("1.open", true);

    expect(paymentRequest.show).toHaveBeenCalled();
    expect(paymentRequest.update).toHaveBeenLastCalledWith({
      currency: "cad",
      displayItems: [{ amount: 75, label: "An Item" }],
      shippingOptions: [
        {
          amount: 25,
          detail: "This is shipping",
          id: "shipping",
          label: "Shipping",
        },
      ],
      total: {
        amount: 100,
        label: "Total",
      },
    });
  });

  it("setOpen calls abort and closes it", async () => {
    canMakePayment.mockReturnValueOnce(
      Promise.resolve({
        applePay: true,
        googlePay: false,
      })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      usePaymentRequest(stripe, options)
    );

    await waitForNextUpdate();

    act(() => result.current[1].setOpen(true));
    isShowing.mockReturnValue(true);

    act(() => result.current[1].setOpen(false));
    isShowing.mockReturnValue(false);

    expect(result.current).toHaveProperty("1.open", false);

    expect(paymentRequest.abort).toHaveBeenCalled();
  });

  it("closes when receiving cancel event", async () => {
    canMakePayment.mockReturnValueOnce(
      Promise.resolve({
        applePay: true,
        googlePay: false,
      })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      usePaymentRequest(stripe, options)
    );

    await waitForNextUpdate();

    act(() => result.current[1].setOpen(true));
    isShowing.mockReturnValue(true);

    act(() => void paymentRequestEmitter.emit("cancel"));

    expect(result.current).toHaveProperty("1.open", false);
  });

  it("creates a new paymentRequest with specific option changes", async () => {
    options = {
      country: "US",
      currency: "usd",
      disableWallets: [],
      displayItems: [],
      requestPayerEmail: false,
      requestPayerName: false,
      requestPayerPhone: false,
      requestShipping: false,
      shippingOptions: [],
      total: {
        amount: 0,
        label: "Total",
        pending: true,
      },
    };

    const { rerender, waitForNextUpdate } = renderHook(
      (props) => usePaymentRequest(...props),
      {
        initialProps: [stripe, options] as const,
      }
    );

    await waitForNextUpdate();

    expect(stripe.paymentRequest).toHaveBeenCalledTimes(1);

    options = { ...options, country: "CA" };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(2);

    options = { ...options, disableWallets: [] };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(3);

    options = { ...options, requestPayerEmail: true };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(4);

    options = { ...options, requestPayerName: true };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(5);

    options = { ...options, requestPayerPhone: true };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(6);

    options = { ...options, requestShipping: true };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(7);

    // These can't be changed on their own, have to happen through a callback
    options = {
      ...options,
      currency: "cad",
      displayItems: [],
      shippingOptions: [],
      total: {
        amount: 100000,
        label: "Total",
      },
    };
    rerender([stripe, options]);
    expect(stripe.paymentRequest).toHaveBeenCalledTimes(7);
  });
});
