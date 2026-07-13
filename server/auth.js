import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./database.js";
import { config } from "./config.js";

function isExpired(expiryDate) {
  if (!expiryDate) return false;

  const today = new Date().toISOString().slice(0, 10);
  return expiryDate < today;
}

function parseIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasLocationAccess(user, hospitalId, locationId) {
  const role = String(user.role || "").toLowerCase();
  const scope = String(user.accessScope || "ALL").toUpperCase();

  if (role === "admin") return true;
  if (user.accessExpiryDate && isExpired(user.accessExpiryDate)) return false;
  if (scope === "ALL") return true;

  if (scope === "HOSPITAL") {
    return parseIdList(user.accessHospitalIds).includes(String(hospitalId || ""));
  }

  if (scope === "LOCATIONS") {
    return parseIdList(user.accessLocationIds).includes(String(locationId || ""));
  }

  return true;
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

  if (user.active === 0) {
    return res.status(403).json({
      message: "This staff account is inactive",
    });
  }

  if (user.staffType !== "Permanent" && isExpired(user.expiryDate)) {
    return res.status(403).json({
      message: "This temporary staff account has expired",
    });
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

  if (
    hospitalId &&
    locationId &&
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

    req.user = decoded;

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
