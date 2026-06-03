import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./database.js";

const JWT_SECRET = "change-this-secret-later";

/* ================= LOGIN USER ================= */

export function loginUser(req, res) {
  const { username, password } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  let passwordMatch = false;

  if (user.password.startsWith("$2b$")) {
    passwordMatch = bcrypt.compareSync(password, user.password);
  } else {
    passwordMatch = password === user.password;
  }

  if (!passwordMatch) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    },
    JWT_SECRET,
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
    },
  });
}

/* ================= CHECK LOGIN TOKEN ================= */

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
      JWT_SECRET
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
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access only",
    });
  }

  next();
}