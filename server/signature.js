import crypto from "crypto";

const SECRET =
  process.env.SIGNATURE_SECRET ||
  "development-controlled-drug-signature-secret";

export function createSignatureHash({
  userId,
  username,
  fullName,
  role,
  action,
  drugName,
  timestamp,
}) {
  const payload = [
    userId,
    username,
    fullName,
    role,
    action,
    drugName,
    timestamp,
    SECRET,
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");
}