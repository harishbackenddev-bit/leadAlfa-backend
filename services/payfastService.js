const crypto = require("crypto");
const axios = require("axios");

const SANDBOX = {
  process: "https://sandbox.payfast.co.za/eng/process",
  validate: "https://sandbox.payfast.co.za/eng/query/validate",
};

const LIVE = {
  process: "https://www.payfast.co.za/eng/process",
  validate: "https://www.payfast.co.za/eng/query/validate",
};

const isConfigured = () =>
  Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);

const isLive = () => process.env.PAYFAST_MODE === "live";
const urls = () => (isLive() ? LIVE : SANDBOX);

const phpUrlencode = (value) =>
  encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

const signature = (fields, passphrase, { keepEmpty = false } = {}) => {
  const base = Object.entries(fields)
    .filter(([, value]) => keepEmpty || (value !== undefined && value !== null && String(value) !== ""))
    .map(([key, value]) => `${key}=${phpUrlencode(String(value ?? "").trim())}`)
    .join("&");

  const withPass = passphrase
    ? `${base}&passphrase=${phpUrlencode(passphrase.trim())}`
    : base;

  return crypto.createHash("md5").update(withPass).digest("hex");
};

function buildCheckout({ reference, amount, itemName, returnUrl, cancelUrl, notifyUrl, email }) {
  const fields = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    email_address: email,
    m_payment_id: reference,
    amount: Number(amount).toFixed(2),
    item_name: itemName,
  };

  return {
    url: urls().process,
    fields: { ...fields, signature: signature(fields, process.env.PAYFAST_PASSPHRASE) },
  };
}

const signatureMatches = (body) => {
  const { signature: received, ...rest } = body;
  if (!received) return false;
  const pass = process.env.PAYFAST_PASSPHRASE;
  return (
    received === signature(rest, pass, { keepEmpty: true }) ||
    received === signature(rest, pass)
  );
};

const VALID_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

async function sourceIsPayFast(remoteIp) {
  const dns = require("dns").promises;
  const allowed = new Set();

  for (const host of VALID_HOSTS) {
    try {
      const addresses = await dns.resolve4(host);
      addresses.forEach((address) => allowed.add(address));
    } catch {
    }
  }

  return allowed.has(remoteIp);
}

async function payfastConfirms(body) {
  const params = new URLSearchParams(body).toString();
  const { data } = await axios.post(urls().validate, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });
  return String(data).trim().startsWith("VALID");
}

module.exports = {
  isConfigured,
  buildCheckout,
  signature,
  signatureMatches,
  sourceIsPayFast,
  payfastConfirms,
  isLive,
};
