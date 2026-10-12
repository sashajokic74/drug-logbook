import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./database.js";
import { config } from "./config.js";
import { createHmac } from "node:crypto";

export function isExpired(expiryDate) {
  if (!expiryDate) return false;

  const today = new Date().toISOString().slice(0, 10);
  return !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ||
    !Number.isFinite(Date.parse(expiryDate)) || expiryDate < today;
}

export function accountUnavailable(user) {
  return !user || Number(user.active) !== 1 ||
    (user.staffType !== "Permanent" && (!user.expiryDate || isExpired(user.expiryDate))) ||
    Boolean(user.accessExpiryDate && isExpired(user.accessExpiryDate));
}

function passwordVersion(user) {
  return createHmac("sha256", config.jwtSecret).update(user.password).digest("hex");
}

export function canWriteClinical(user) {
  return ["odp", "nurse", "theatre_practitioner", "anaesthetic_practitioner"].includes(
    String(user?.role || "").toLowerCase()
  );
}

export function clinicalOnly(req, res, next) {
  if (!canWriteClinical(req.user)) return res.status(403).json({ message: "Clinical staff access required" });
  next();
}

export function clinicalWriteOnly(req, res, next) {
  if (req.method === "GET") return next();
  return clinicalOnly(req, res, next);
}

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasLocationAccess(user, hospitalId, locationId) {
  if (accountUnavailable(user)) return false;
  const role = String(user.role || "").toLowerCase();
  const scope = String(user.accessScope || "ALL").toUpperCase();

  if (role === "admin") return true;
  if (scope === "ALL") return true;

  if (scope === "HOSPITAL") {
    const location = db.prepare("SELECT hospitalId FROM locations WHERE id = ? AND active = 1").get(Number(locationId));
    return Boolean(location && String(location.hospitalId) === String(hospitalId) &&
      parseIdList(user.accessHospitalIds).includes(String(hospitalId || "")));
  }

  if (scope === "LOCATIONS") {
    const location = db.prepare("SELECT hospitalId FROM locations WHERE id = ? AND active = 1").get(Number(locationId));
    return Boolean(location && String(location.hospitalId) === String(hospitalId) &&
      parseIdList(user.accessLocationIds).includes(String(locationId || "")));
  }

  return false;
}

export function requireLocationAccess(req, res, next) {
  const source = req.method === "GET" ? req.query : req.body;
  if (!hasLocationAccess(req.user, source?.hospitalId, source?.locationId)) {
    return res.status(403).json({ message: "This account cannot access the requested location" });
  }
  next();
}

function isSignatureOnlyRole(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  return (
    role === "doctor" ||
    role === "dr" ||
    role.startsWith("dr ") ||
    role.includes(" doctor") ||
    role.includes("surgeon") ||
    role.includes("anaesthetist")
  );
}

/* ================= LOGIN USER ================= */

export function loginUser(req, res) {
  const { username, password, hospitalId, locationId, locationName } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  if (accountUnavailable(user)) {
    return res.status(403).json({ message: "This staff account is inactive or has expired" });
  }

  const passwordMatch = bcrypt.compareSync(
    password,
    user.password
  );

  if (!passwordMatch) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  if (isSignatureOnlyRole(user.role)) {
    return res.status(403).json({
      message:
        "Doctor, anaesthetist and surgeon accounts are for drug administration signatures only. Please ask authorised theatre staff to log into the iPad.",
    });
  }

  if (
    (hospitalId || locationId) &&
    !hasLocationAccess(user, hospitalId, locationId)
  ) {
    return res.status(403).json({
      message: `This staff account is not assigned to ${locationName || "this location"}`,
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      sessionVersion: user.sessionVersion,
      passwordVersion: passwordVersion(user),
      accessScope: user.accessScope || "ALL",
      accessHospitalIds: user.accessHospitalIds || "",
      accessLocationIds: user.accessLocationIds || "",
      accessExpiryDate: user.accessExpiryDate || null,
    },
    config.jwtSecret,
    {
      expiresIn: "8h",
    }
  );

  return res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      accessScope: user.accessScope || "ALL",
      accessHospitalIds: user.accessHospitalIds || "",
      accessLocationIds: user.accessLocationIds || "",
      accessExpiryDate: user.accessExpiryDate || null,
    },
  });
}

/* ================= VERIFY TOKEN ================= */

export function verifyUser(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      config.jwtSecret
    );

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
    // Re-read permissions and account status; a signed JWT is not a live grant.
    if (accountUnavailable(user) || decoded.sessionVersion !== user.sessionVersion ||
        decoded.passwordVersion !== passwordVersion(user) || isSignatureOnlyRole(user.role)) {
      return res.status(401).json({ message: "Session revoked or account expired. Please sign in again." });
    }
    const { password, ...currentUser } = user;
    req.user = currentUser;

    next();

  } catch (error) {

    return res.status(401).json({
      message: "Invalid token",
    });

  }
}

/* ================= ADMIN ONLY ================= */

export function adminOnly(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();

  if (role !== "admin") {
    return res.status(403).json({
      message: "Admin access only",
    });
  }

  next();
}
