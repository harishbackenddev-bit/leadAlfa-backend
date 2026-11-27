const crypto = require("crypto");
const payfast = require("../services/payfastService");
const shipmentService = require("../services/shipmentService");

const secretMatches = (given) => {
  const expected = process.env.PAYFAST_WEBHOOK_SECRET_PATH || "";
  if (!expected || !given || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

const payfastItnController = async (req, res) => {
  if (!secretMatches(req.params.secret)) {
    return res.status(404).json({ error: "Not found" });
  }

  res.status(200).send("OK");

  const body = req.body || {};
  const reference = body.m_payment_id;

  try {
    console.log("payfast itn received", {
      reference,
      paymentStatus: body.payment_status,
      amountGross: body.amount_gross,
      pfPaymentId: body.pf_payment_id,
      fields: Object.keys(body).length,
    });

    if (body.payment_status !== "COMPLETE") {
      console.warn("payfast itn: not complete", { reference, status: body.payment_status });
      return;
    }

    if (!payfast.signatureMatches(body)) {
      console.warn("payfast itn: signature mismatch", { reference });
      return;
    }

    const remoteIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
    if (!(await payfast.sourceIsPayFast(remoteIp))) {
      console.warn("payfast itn: source ip not recognised", { reference, remoteIp });
    }

    const expected = await shipmentService.expectedPaymentFor(reference);
    if (!expected) {
      console.warn("payfast itn: unknown reference", { reference });
      return;
    }

    if (Number(body.amount_gross) !== expected.amount) {
      console.warn("payfast itn: amount mismatch", {
        reference,
        paid: body.amount_gross,
        expected: expected.amount,
      });
      return;
    }

    if (!(await payfast.payfastConfirms(body))) {
      console.warn("payfast itn: payfast did not confirm", { reference });
      return;
    }

    await shipmentService.bookPaidShipments(reference, body.pf_payment_id);
    console.log("payfast itn: booked", { reference });
  } catch (err) {
    console.error("payfast itn failed", { reference, message: err.message });
  }
};

module.exports = { payfastItnController };
