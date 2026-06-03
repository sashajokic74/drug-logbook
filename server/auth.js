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