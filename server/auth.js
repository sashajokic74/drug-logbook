import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./database.js";

const JWT_SECRET = "change-this-secret-later";

export function seedAdminUser() {
  const existingAdmin = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get("admin");

  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);

    db.prepare(`
      INSERT INTO users (username, password, role)
      VALUES (?, ?, ?)
    `).run("admin", hashedPassword, "admin");

    console.log("Default admin user created");
  }
}

export function loginUser(req, res) {
  const { username, password } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}