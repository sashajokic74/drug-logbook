import express from "express";
import db from "../database.js";

const router = express.Router();

function makeRequisitionNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `CD-${date}-${random}`;
}

function isAuthorisedRequester(roleValue) {
  const role = String(roleValue || "").toLowerCase();

  if (
    role === "admin" ||
    role === "doctor" ||
    role === "dr" ||
    role.startsWith("dr ") ||
    role.includes(" doctor") ||
    role.includes("surgeon") ||
    role.includes("anaesthetist")
  ) {
    return false;
  }

  return (
    role.includes("odp") ||
    role.includes("anaesthetic") ||
    role.includes("anaesthetics") ||
    role.includes("nurse") ||
    role.includes("theatre")
  );
}

function canManagePharmacyRequests(roleValue) {
  const role = String(roleValue || "").toLowerCase();
  return role === "admin" || role === "pharmacy" || role === "pharmacist";
}

router.post("/", (req, res) => {
  try {
    const {
      drugId,
      quantityRequested,
      reason,
      requestedById,
      requestedByName,
      requestedByRole,
      hospitalId,
      hospitalName,
      locationId,
      locationName,
    } = req.body;

    if (!drugId || !quantityRequested) {
      return res.status(400).json({
        message: "Drug and quantity requested are required",
      });
    }

    if (!requestedById || !requestedByName || !requestedByRole) {
      return res.status(400).json({
        message: "Verified authorised staff is required",
      });
    }

    if (!isAuthorisedRequester(requestedByRole)) {
      return res.status(403).json({
        message:
          "Only ODP, anaesthetic practitioner, theatre practitioner or nurse can request controlled drug pharmacy supply.",
      });
    }

    const drug = db
      .prepare(
        "SELECT id, name, size, concentration, quantity FROM drugs WHERE id = ?"
      )
      .get(drugId);

    if (!drug) {
      return res.status(404).json({
        message: "Drug not found",
      });
    }

    const requisitionNumber = makeRequisitionNumber();

    const insert = db.prepare(`
      INSERT INTO pharmacy_requests (
        requisitionNumber,
        drugId,
        drugName,
        quantityRequested,
        reason,
        requestedById,
        requestedByName,
        requestedByRole,
        hospitalId,
        hospitalName,
        locationId,
        locationName,
        status,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = insert.run(
      requisitionNumber,
      drug.id,
      drug.name,
      Number(quantityRequested),
      reason || "Routine top up",
      requestedById,
      requestedByName,
      requestedByRole,
      hospitalId || null,
      hospitalName || "",
      locationId || null,
      locationName || "",
      "REQUESTED"
    );

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(info.lastInsertRowid);

    return res.status(201).json({
      message: "Pharmacy request created",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/", (req, res) => {
  try {
    const { hospitalId, locationId, status } = req.query;
    const params = [];
    let sql = `
      SELECT *
      FROM pharmacy_requests
      WHERE 1 = 1
    `;

    if (hospitalId) {
      sql += " AND hospitalId = ?";
      params.push(Number(hospitalId));
    }

    if (locationId) {
      sql += " AND locationId = ?";
      params.push(Number(locationId));
    }

    if (status && status !== "ALL") {
      sql += " AND upper(status) = ?";
      params.push(String(status).toUpperCase());
    }

    sql += " ORDER BY createdAt DESC";

    const requests = db.prepare(sql).all(...params);

    return res.json(requests);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/pending", (req, res) => {
  try {
    const requests = db
      .prepare(`
        SELECT *
        FROM pharmacy_requests
        WHERE status = 'REQUESTED'
        ORDER BY createdAt ASC
      `)
      .all();

    return res.json(requests);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/:id/approve", (req, res) => {
  try {
    const { id } = req.params;

    if (!canManagePharmacyRequests(req.user?.role)) {
      return res.status(403).json({
        message: "Only admin or pharmacy users can approve pharmacy requests",
      });
    }

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    if (!request) {
      return res.status(404).json({
        message: "Pharmacy request not found",
      });
    }

    if (request.status !== "REQUESTED") {
      return res.status(400).json({
        message: `Only REQUESTED requests can be approved. Current status: ${request.status}`,
      });
    }

    db.prepare(`
      UPDATE pharmacy_requests
      SET status = 'APPROVED'
      WHERE id = ?
    `).run(id);

    const updatedRequest = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    return res.json({
      message: "Pharmacy request approved",
      request: updatedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/:id/reject", (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!canManagePharmacyRequests(req.user?.role)) {
      return res.status(403).json({
        message: "Only admin or pharmacy users can reject pharmacy requests",
      });
    }

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    if (!request) {
      return res.status(404).json({
        message: "Pharmacy request not found",
      });
    }

    if (request.status !== "REQUESTED") {
      return res.status(400).json({
        message: `Only REQUESTED requests can be rejected. Current status: ${request.status}`,
      });
    }

    db.prepare(`
      UPDATE pharmacy_requests
      SET status = 'REJECTED',
          reason = ?
      WHERE id = ?
    `).run(reason || request.reason || "Rejected by pharmacy", id);

    const updatedRequest = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    return res.json({
      message: "Pharmacy request rejected",
      request: updatedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/verify-requisition", (req, res) => {
  try {
    const { requisitionNumber, drugId, quantityReceived, hospitalId, locationId } = req.body;

    if (!requisitionNumber) {
      return res.status(400).json({
        message: "Requisition number is required",
      });
    }

    if (!drugId) {
      return res.status(400).json({
        message: "Drug ID is required",
      });
    }

    if (!quantityReceived || Number(quantityReceived) <= 0) {
      return res.status(400).json({
        message: "Quantity received is required",
      });
    }

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE requisitionNumber = ?")
      .get(requisitionNumber);

    if (!request) {
      return res.status(404).json({
        message: "Requisition number not found",
      });
    }

    if (Number(request.drugId) !== Number(drugId)) {
      return res.status(400).json({
        message: "Requisition number does not match this drug",
      });
    }

    if (
      hospitalId &&
      request.hospitalId &&
      Number(request.hospitalId) !== Number(hospitalId)
    ) {
      return res.status(400).json({
        message: "Requisition number does not match this hospital",
      });
    }

    if (
      locationId &&
      request.locationId &&
      Number(request.locationId) !== Number(locationId)
    ) {
      return res.status(400).json({
        message: "Requisition number does not match this location",
      });
    }

    if (request.status !== "APPROVED" && request.status !== "REQUESTED") {
      return res.status(400).json({
        message: `Requisition cannot be used because status is ${request.status}`,
      });
    }

    if (Number(request.quantityRequested) !== Number(quantityReceived)) {
      return res.status(400).json({
        message: `Quantity mismatch. Requested ${request.quantityRequested}, received ${quantityReceived}`,
      });
    }

    return res.status(200).json({
      message: "Requisition verified",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/:id/complete", (req, res) => {
  try {
    const { id } = req.params;

    const request = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    if (!request) {
      return res.status(404).json({
        message: "Pharmacy request not found",
      });
    }

    if (request.status === "COMPLETED") {
      return res.status(400).json({
        message: "Pharmacy request is already completed",
      });
    }

    db.prepare(`
      UPDATE pharmacy_requests
      SET status = 'COMPLETED',
          completedAt = datetime('now')
      WHERE id = ?
    `).run(id);

    const updatedRequest = db
      .prepare("SELECT * FROM pharmacy_requests WHERE id = ?")
      .get(id);

    return res.json({
      message: "Pharmacy request completed",
      request: updatedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

export default router;
