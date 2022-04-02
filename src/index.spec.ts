import "promise-any-polyfill";

import EventEmitter from "events";

import { beforeEach, describe, expect, it } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-hooks";

import {
  usePaymentRequest,
  usePaymentRequestPaymentMethod,
  usePaymentRequestShippingAddress,
  usePaymentRequestShippingOption,
} from ".";

import type {
  CanMakePaymentResult,
  PaymentRequest,
  PaymentRequestCompleteStatus,
  PaymentRequestEvent,
  PaymentRequestOptions,
  PaymentRequestPaymentMethodEvent,
  PaymentRequestShippingAddress,
  PaymentRequestShippingAddressEvent,
  PaymentRequestShippingOption,
  PaymentRequestShippingOptionEvent,
  PaymentRequestUpdateDetails,
  PaymentRequestUpdateDetailsStatus,
  Stripe,
} from "@stripe/stripe-js";

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
});

describe("usePaymentRequest", () => {
  let stripe: Stripe;

  beforeEach(() => {
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

const shippingAddress: PaymentRequestShippingAddress = {
  addressLine: ["185 Berry St."],
  city: "San Francisco",
  country: "US",
  postalCode: "94941",
  recipient: "Jenny Rosen",
  region: "CA",
};

const shippingOption: PaymentRequestShippingOption = {
  id: "basic",
  label: "Ground shipping",
  detail: "Ground shipping via UPS or FedEx",
  amount: 995,
};

[
  {
    eventBase: { shippingAddress },
    eventName: "shippingaddresschange",
    name: "usePaymentRequestShippingAddress",
    useShippingHook: usePaymentRequestShippingAddress,
  },
  {
    eventBase: { shippingOption },
    eventName: "shippingoptionchange",
    name: "usePaymentRequestShippingOption",
    useShippingHook: usePaymentRequestShippingOption,
  },
].forEach(({ eventBase, eventName, name, useShippingHook }) => {
  describe(`${name}`, () => {
    const updateDetails = {
      total: {
        amount: 100,
        label: "Total",
      },
    };
    let event: (
      | PaymentRequestShippingAddressEvent
      | PaymentRequestShippingOptionEvent
    ) & {
      updateWith: jest.Mock<void, [PaymentRequestUpdateDetails]>;
    };
    let onEvent: jest.Mock<Promise<PaymentRequestUpdateDetailsStatus>, []>;

    beforeEach(() => {
      event = {
        ...eventBase,
        updateWith: jest.fn<void, [PaymentRequestUpdateDetails]>(),
      };

      onEvent = jest.fn<Promise<PaymentRequestUpdateDetailsStatus>, []>();
    });

    it("does nothing with undefined paymentRequest", () => {
      renderHook(() => useShippingHook(undefined, updateDetails, onEvent));

      expect(onEvent).not.toHaveBeenCalled();
    });

    it("does not register without handler", () => {
      renderHook(() => useShippingHook(paymentRequest, updateDetails));

      expect(paymentRequest.on).not.toHaveBeenCalled();
      expect(paymentRequest.off).not.toHaveBeenCalled();
    });

    it("does nothing before event", () => {
      renderHook(() => useShippingHook(paymentRequest, updateDetails, onEvent));

      expect(onEvent).not.toHaveBeenCalled();
    });

    it(`succeeds with object`, async () => {
      const { waitForNextUpdate } = renderHook(() =>
        useShippingHook(paymentRequest, updateDetails, onEvent)
      );

      onEvent.mockReturnValueOnce(Promise.resolve("success"));

      act(() => void paymentRequestEmitter.emit(eventName, event));

      await waitForNextUpdate();

      expect(event.updateWith).toHaveBeenCalledWith({
        ...updateDetails,
        status: "success",
      });
    });

    it(`fails without details`, async () => {
      const { waitForNextUpdate } = renderHook(() =>
        useShippingHook(paymentRequest, updateDetails, onEvent)
      );

      onEvent.mockReturnValueOnce(Promise.resolve("fail"));

      act(() => void paymentRequestEmitter.emit(eventName, event));

      await waitForNextUpdate();

      expect(event.updateWith).toHaveBeenLastCalledWith({ status: "fail" });
    });
  });
});

describe("usePaymentRequestPaymentMethod", () => {
  const eventName = "paymentmethod";
  const paymentResponse: Omit<PaymentRequestPaymentMethodEvent, "complete"> = {
    methodName: "applePay",
    walletName: "applePay",
    paymentMethod: {
      id: "pm_1KfA8UEcNkU7uOokoK0r0mWt",
      object: "payment_method",
      billing_details: {
        address: {
          city: "Sydney",
          country: "AU",
          line1: "255 Morrison Rd",
          line2: null,
          postal_code: "2112",
          state: "NSW",
        },
        email: "jenny@example.com",
        name: null,
        phone: "+15555555555",
      },
      created: 123456789,
      customer: null,
      livemode: false,
      metadata: {
        order_id: "123456789",
      },
      type: "card",
    },
  };
  let event: PaymentRequestEvent & {
    complete: jest.Mock<void, [PaymentRequestCompleteStatus]>;
  };
  let onEvent: jest.Mock<
    Promise<PaymentRequestCompleteStatus>,
    [Omit<PaymentRequestPaymentMethodEvent, "complete">]
  >;

  beforeEach(() => {
    event = {
      ...paymentResponse,
      complete: jest.fn<void, [PaymentRequestCompleteStatus]>(),
    };

    onEvent = jest.fn<
      Promise<PaymentRequestCompleteStatus>,
      [Omit<PaymentRequestPaymentMethodEvent, "complete">]
    >();
  });

  it("does nothing with undefined paymentRequest", () => {
    renderHook(() => usePaymentRequestPaymentMethod(undefined, onEvent));

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("does not register without handler", () => {
    renderHook(() => usePaymentRequestPaymentMethod(paymentRequest));

    expect(paymentRequest.on).not.toHaveBeenCalled();
    expect(paymentRequest.off).not.toHaveBeenCalled();
  });

  it("does nothing before event", () => {
    renderHook(() => usePaymentRequestPaymentMethod(paymentRequest, onEvent));

    expect(onEvent).not.toHaveBeenCalled();
  });

  it(`succeeds`, (done) => {
    renderHook(() => usePaymentRequestPaymentMethod(paymentRequest, onEvent));

    onEvent.mockReturnValueOnce(Promise.resolve("success"));

    event.complete.mockImplementation((value) => {
      expect(value).toBe("success");
      done();
    });

    act(() => void paymentRequestEmitter.emit(eventName, event));
  });

  it(`fails`, (done) => {
    renderHook(() => usePaymentRequestPaymentMethod(paymentRequest, onEvent));

    onEvent.mockReturnValueOnce(Promise.resolve("fail"));

    event.complete.mockImplementation((value) => {
      expect(value).toBe("fail");
      done();
    });

    act(() => void paymentRequestEmitter.emit(eventName, event));
  });
});
