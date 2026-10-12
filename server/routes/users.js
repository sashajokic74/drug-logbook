import express from "express";
import db from "../database.js";
import { verifyUser, adminOnly } from "../auth.js";
import bcrypt from "bcrypt";

const router = express.Router();


router.get("/", verifyUser, adminOnly, (req, res) => {
	try {
		const users = db
			.prepare(`
        SELECT
          id,
          username,
          role,
          fullName,
          active,
          staffType,
          expiryDate,
          accessScope,
          accessHospitalIds,
          accessLocationIds,
          accessExpiryDate,
          createdAt
        FROM users
        ORDER BY id ASC
      `)
			.all();

		return res.status(200).json(users);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post("/", verifyUser, adminOnly, (req, res) => {
	try {
		const {
			username,
			password,
			role,
			fullName,
			staffType,
			expiryDate,
			accessScope,
			accessHospitalIds,
			accessLocationIds,
			accessExpiryDate,
		} =
			req.body;

		if (!username || !password || !role || !fullName) {
			return res.status(400).json({
				message: "Full name, username, password and role are required",
			});
		}

		const finalStaffType = staffType || "Permanent";
		const finalExpiryDate = expiryDate || null;
		const finalAccessScope = accessScope || "ALL";
		const finalAccessHospitalIds = Array.isArray(accessHospitalIds)
			? accessHospitalIds.join(",")
			: accessHospitalIds || "";
		const finalAccessLocationIds = Array.isArray(accessLocationIds)
			? accessLocationIds.join(",")
			: accessLocationIds || "";
		const finalAccessExpiryDate = accessExpiryDate || null;

		if (finalStaffType !== "Permanent" && !finalExpiryDate) {
			return res.status(400).json({
				message: "Temporary, Bank, Agency or Locum staff need an expiry date",
			});
		}

		const existingUser = db
			.prepare("SELECT * FROM users WHERE username = ?")
			.get(username);

		if (existingUser) {
			return res.status(409).json({
				message: "Username already exists",
			});
		}

		const hashedPassword = bcrypt.hashSync(password, 10);

		const result = db
			.prepare(`
        INSERT INTO users
        (
          username,
          password,
          role,
          fullName,
          active,
          staffType,
          expiryDate,
          accessScope,
          accessHospitalIds,
          accessLocationIds,
          accessExpiryDate
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
			.run(
				username,
				hashedPassword,
				role,
				fullName,
				1,
				finalStaffType,
				finalExpiryDate,
				finalAccessScope,
				finalAccessHospitalIds,
				finalAccessLocationIds,
				finalAccessExpiryDate
			);

		const newUser = db
			.prepare(`
        SELECT
          id,
          username,
          role,
          fullName,
          active,
          staffType,
          expiryDate,
          accessScope,
          accessHospitalIds,
          accessLocationIds,
          accessExpiryDate,
          createdAt
        FROM users
        WHERE id = ?
      `)
			.get(result.lastInsertRowid);

		db.prepare(`
      INSERT INTO audit (action, username, role)
      VALUES (?, ?, ?)
    `).run(
			`Created user: ${newUser.username} (${newUser.staffType})`,
			req.user.username,
			req.user.role
		);

		return res.status(201).json(newUser);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.put("/:id/deactivate", verifyUser, adminOnly, (req, res) => {
	try {
		const userToDeactivate = db
			.prepare("SELECT * FROM users WHERE id = ?")
			.get(Number(req.params.id));

		if (!userToDeactivate) {
			return res.status(404).json({
				message: "User not found",
			});
		}

		if (userToDeactivate.username === "admin") {
			return res.status(400).json({
				message: "Main admin account cannot be deactivated",
			});
		}

		db.prepare("UPDATE users SET active = 0, sessionVersion = sessionVersion + 1 WHERE id = ?").run(
			Number(req.params.id)
		);

		db.prepare(`
      INSERT INTO audit (action, username, role)
      VALUES (?, ?, ?)
    `).run(
			`Deactivated user: ${userToDeactivate.username}`,
			req.user.username,
			req.user.role
		);

		return res.status(200).json({
			message: "User deactivated",
		});
	} catch (error) {
		return res.status(500).json({
			message: error.message,
		});
	}
});

router.put("/:id/reactivate", verifyUser, adminOnly, (req, res) => {
	try {
		const userToReactivate = db
			.prepare("SELECT * FROM users WHERE id = ?")
			.get(Number(req.params.id));

		if (!userToReactivate) {
			return res.status(404).json({
				message: "User not found",
			});
		}

		db.prepare("UPDATE users SET active = 1 WHERE id = ?").run(
			Number(req.params.id)
		);

		db.prepare(`
      INSERT INTO audit (action, username, role)
      VALUES (?, ?, ?)
    `).run(
			`Reactivated user: ${userToReactivate.username}`,
			req.user.username,
			req.user.role
		);

		return res.status(200).json({
			message: "User reactivated",
		});
	} catch (error) {
		return res.status(500).json({
			message: error.message,
		});
	}
});

export default router;
