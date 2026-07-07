import express from "express";
import db from "../database.js";

const router = express.Router();

router.get("/hospitals", (req, res) => {
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

router.post("/hospitals", (req, res) => {
	try {
		const { name } = req.body;
		const hospitalName = String(name || "").trim();

		if (!hospitalName) {
			return res.status(400).json({ message: "Hospital name is required" });
		}

		const existingHospital = db
			.prepare(
				"SELECT * FROM hospitals WHERE lower(name) = lower(?) AND active = 1"
			)
			.get(hospitalName);

		if (existingHospital) {
			return res.status(200).json(existingHospital);
		}

		const result = db
			.prepare(`
        INSERT INTO hospitals (name, active)
        VALUES (?, 1)
      `)
			.run(hospitalName);

		const hospital = db
			.prepare("SELECT * FROM hospitals WHERE id = ?")
			.get(result.lastInsertRowid);

		return res.status(201).json(hospital);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.get("/locations", (req, res) => {
	try {
		const { hospitalId } = req.query;

		if (!hospitalId) {
			return res.status(400).json({ message: "Hospital is required" });
		}

		const locations = db
			.prepare(`
        SELECT *
        FROM locations
        WHERE active = 1
          AND hospitalId = ?
        ORDER BY name ASC
      `)
			.all(Number(hospitalId));

		return res.json(locations);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post("/locations", (req, res) => {
	try {
		const { hospitalId, name, type } = req.body;
		const locationName = String(name || "").trim();

		if (!hospitalId || !locationName) {
			return res.status(400).json({
				message: "Hospital and location name are required",
			});
		}

		const hospital = db
			.prepare("SELECT * FROM hospitals WHERE id = ? AND active = 1")
			.get(Number(hospitalId));

		if (!hospital) {
			return res.status(404).json({ message: "Hospital not found" });
		}

		const existingLocation = db
			.prepare(`
        SELECT *
        FROM locations
        WHERE hospitalId = ?
          AND lower(name) = lower(?)
          AND active = 1
      `)
			.get(Number(hospitalId), locationName);

		if (existingLocation) {
			return res.status(200).json(existingLocation);
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
				locationName,
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

router.get("/devices", (req, res) => {
	try {
		const { hospitalId, locationId } = req.query;
		const params = [];

		let sql = `
      SELECT *
      FROM devices
      WHERE active = 1
    `;

		if (hospitalId) {
			sql += " AND hospitalId = ?";
			params.push(Number(hospitalId));
		}

		if (locationId) {
			sql += " AND locationId = ?";
			params.push(Number(locationId));
		}

		sql += " ORDER BY hospitalName ASC, locationName ASC, deviceName ASC";

		const devices = db.prepare(sql).all(...params);

		return res.json(devices);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post("/devices", (req, res) => {
	try {
		const {
			deviceName,
			deviceCode,
			hospitalId,
			hospitalName,
			locationId,
			locationName,
			deviceType,
		} = req.body;

		if (!deviceName || !deviceCode || !hospitalId || !locationId) {
			return res.status(400).json({
				message: "Device name, code, hospital and location are required",
			});
		}

		const existingDevice = db
			.prepare("SELECT * FROM devices WHERE deviceCode = ? AND active = 1")
			.get(deviceCode);

		if (existingDevice) {
			return res.status(200).json(existingDevice);
		}

		const result = db
			.prepare(`
        INSERT INTO devices
        (
          deviceName,
          deviceCode,
          hospitalId,
          hospitalName,
          locationId,
          locationName,
          deviceType,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `)
			.run(
				deviceName,
				deviceCode,
				Number(hospitalId),
				hospitalName || "",
				Number(locationId),
				locationName || "",
				deviceType || "iPad"
			);

		const device = db
			.prepare("SELECT * FROM devices WHERE id = ?")
			.get(result.lastInsertRowid);

		return res.status(201).json(device);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

export default router;
