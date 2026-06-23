import express from "express";
import db from "./database.js";
import { verifyUser, adminOnly } from "./auth.js";

const router = express.Router();

/* ================= HOSPITALS ================= */

router.get("/hospitals", verifyUser, (req, res) => {
  try {
    const hospitals = db
      .prepare(`
        SELECT *
        FROM hospitals
        WHERE active = 1
        ORDER BY name ASC
      `)
      .all();

    return res.json(hospitals);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/hospitals", verifyUser, adminOnly, (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Hospital name is required" });
    }

    const result = db
      .prepare(`
        INSERT INTO hospitals (name, active)
        VALUES (?, 1)
      `)
      .run(name);

    const hospital = db
      .prepare("SELECT * FROM hospitals WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(hospital);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/* ================= LOCATIONS ================= */

router.get("/", verifyUser, (req, res) => {
  try {
    const locations = db
      .prepare(`
        SELECT *
        FROM locations
        WHERE active = 1
        ORDER BY hospitalName ASC, name ASC
      `)
      .all();

    return res.json(locations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", verifyUser, adminOnly, (req, res) => {
  try {
    const { hospitalId, name, type } = req.body;

    if (!hospitalId || !name) {
      return res.status(400).json({
        message: "Hospital and location name are required",
      });
    }

    const hospital = db
      .prepare("SELECT * FROM hospitals WHERE id = ?")
      .get(Number(hospitalId));

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const result = db
      .prepare(`
        INSERT INTO locations
        (
          hospitalId,
          hospitalName,
          name,
          type,
          active
        )
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(
        hospital.id,
        hospital.name,
        name,
        type || "Theatre"
      );

    const location = db
      .prepare("SELECT * FROM locations WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json(location);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id/deactivate", verifyUser, adminOnly, (req, res) => {
  try {
    const location = db
      .prepare("SELECT * FROM locations WHERE id = ?")
      .get(Number(req.params.id));

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    db.prepare("UPDATE locations SET active = 0 WHERE id = ?").run(
      Number(req.params.id)
    );

    return res.json({ message: "Location deactivated" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;