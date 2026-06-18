import express from "express";
import bcrypt from "bcrypt";
import db from "./database.js";

const router = express.Router();

function isExpired(expiryDate) {
  if (!expiryDate) return false;

  const today = new Date().toISOString().slice(0, 10);

  return expiryDate < today;
}

router.post("/verify", (req, res) => {
  try {
    const { username, password, currentUserId } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const checker = db
      .prepare(`
        SELECT 
          id, 
          username, 
          password, 
          role, 
          fullName, 
          active,
          staffType,
          expiryDate
        FROM users
        WHERE username = ?
      `)
      .get(username);

    if (!checker) {
      return res.status(401).json({
        message: "Staff member not found",
      });
    }

    if (Number(checker.active) === 0) {
      return res.status(403).json({
        message: "Staff account is inactive",
      });
    }

    if (checker.staffType !== "Permanent" && isExpired(checker.expiryDate)) {
      return res.status(403).json({
        message: "Temporary staff access has expired",
      });
    }

    if (Number(checker.id) === Number(currentUserId)) {
      return res.status(400).json({
        message: "Same person cannot administer and check",
      });
    }

    const validPassword = bcrypt.compareSync(password, checker.password);

    if (!validPassword) {
      return res.status(401).json({
        message: "Incorrect password",
      });
    }

    return res.status(200).json({
      id: checker.id,
      username: checker.username,
      fullName: checker.fullName,
      role: checker.role,
      staffType: checker.staffType || "Permanent",
      expiryDate: checker.expiryDate || null,
      message: "Staff verified",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

export default router;