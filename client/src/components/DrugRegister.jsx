import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:8000";
const REORDER_LEVEL = 5;

function DrugRegister({ drug, device, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [transactions, setTransactions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientMessage, setPatientMessage] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [balance, setBalance] = useState(Number(drug.quantity || 0));

  const [showPharmacyRequest, setShowPharmacyRequest] = useState(false);
  const [showSupplyForm, setShowSupplyForm] = useState(false);

  const [pharmacyRequestMessage, setPharmacyRequestMessage] = useState("");
  const [pharmacyRequestUser, setPharmacyRequestUser] = useState(null);
  const [locationPharmacyRequests, setLocationPharmacyRequests] = useState([]);

  const [verifiedRequisition, setVerifiedRequisition] = useState(null);
  const [supplyMessage, setSupplyMessage] = useState("");
  const [supplyReceivedUser, setSupplyReceivedUser] = useState(null);
  const [supplyCheckerUser, setSupplyCheckerUser] = useState(null);

  const [pharmacyRequestForm, setPharmacyRequestForm] = useState({
    quantityRequested: "",
    reason: "Routine top up",
  });

  const [pharmacyRequestLogin, setPharmacyRequestLogin] = useState({
    username: "",
    password: "",
  });

  const [supplyForm, setSupplyForm] = useState({
    ampoulesReceived: "",
    requisitionNumber: "",
  });

  const [supplyReceivedLogin, setSupplyReceivedLogin] = useState({
    username: "",
    password: "",
  });

  const [supplyCheckerLogin, setSupplyCheckerLogin] = useState({
    username: "",
    password: "",
  });

  const [newPatient, setNewPatient] = useState({
    patientName: "",
    hospitalNumber: "",
    speciality: "",
    procedure: "",
    listDate: today,
  });

  const [administeredUser, setAdministeredUser] = useState(null);
  const [checkerUser, setCheckerUser] = useState(null);

  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [checkerForm, setCheckerForm] = useState({ username: "", password: "" });

  const [form, setForm] = useState({
    patientName: "",
    hospitalNumber: "",
    ampoulesUsed: "",
    amountAdministered: "",
    administeredUnit: "mcg",
    amountWasted: "",
    wastedUnit: "mcg",
    notes: "",
  });
  const patientEntryRef = useRef(null);

  useEffect(() => {
    loadTransactions();
    loadPatients();
    loadLocationPharmacyRequests();
  }, [drug.id, device?.locationId]);

  async function loadTransactions() {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();

      if (device?.hospitalId) params.set("hospitalId", device.hospitalId);
      if (device?.locationId) params.set("locationId", device.locationId);

      const query = params.toString() ? `?${params.toString()}` : "";
      const transactionsResponse = await fetch(
        `${API_URL}/transactions/${drug.id}${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const transactionsData = await transactionsResponse.json();
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);

      const drugParams = new URLSearchParams();
      if (device?.hospitalId) drugParams.set("hospitalId", device.hospitalId);
      if (device?.hospitalName) drugParams.set("hospitalName", device.hospitalName);
      if (device?.locationId) drugParams.set("locationId", device.locationId);
      if (device?.locationName) drugParams.set("locationName", device.locationName);

      const drugsQuery = drugParams.toString()
        ? `?${drugParams.toString()}`
        : "";
      const drugsResponse = await fetch(`${API_URL}/drugs${drugsQuery}`);
      const drugsData = await drugsResponse.json();

      const currentDrug = drugsData.find(
        (item) => Number(item.id) === Number(drug.id)
      );

      if (currentDrug) {
        setBalance(Number(currentDrug.quantity || 0));
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function loadPatients() {
    if (!device?.hospitalId || !device?.locationId) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/patients?hospitalId=${device.hospitalId}&locationId=${device.locationId}&listDate=${today}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setPatientMessage(data.message || "Could not load patient list");
        return;
      }

      setPatients(Array.isArray(data) ? data : []);
    } catch {
      setPatientMessage("Could not load patient list");
    }
  }

  async function loadLocationPharmacyRequests() {
    if (!device?.hospitalId || !device?.locationId) return;

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        hospitalId: device.hospitalId,
        locationId: device.locationId,
      });
      const response = await fetch(`${API_URL}/pharmacy-requests?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (response.ok) {
        setLocationPharmacyRequests(Array.isArray(data) ? data : []);
      }
    } catch {
      setLocationPharmacyRequests([]);
    }
  }

  function updateForm(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function updateAdminForm(e) {
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  }

  function updateCheckerForm(e) {
    setCheckerForm({ ...checkerForm, [e.target.name]: e.target.value });
  }

  function updateSupplyForm(e) {
    setSupplyForm({ ...supplyForm, [e.target.name]: e.target.value });
    setVerifiedRequisition(null);
    setSupplyMessage("");
  }

  function updateSupplyReceivedLogin(e) {
    setSupplyReceivedLogin({
      ...supplyReceivedLogin,
      [e.target.name]: e.target.value,
    });
  }

  function updateSupplyCheckerLogin(e) {
    setSupplyCheckerLogin({
      ...supplyCheckerLogin,
      [e.target.name]: e.target.value,
    });
  }

  function updatePharmacyRequestForm(e) {
    setPharmacyRequestForm({
      ...pharmacyRequestForm,
      [e.target.name]: e.target.value,
    });
  }

  function updatePharmacyRequestLogin(e) {
    setPharmacyRequestLogin({
      ...pharmacyRequestLogin,
      [e.target.name]: e.target.value,
    });
  }

  function updateNewPatient(event) {
    setNewPatient({
      ...newPatient,
      [event.target.name]: event.target.value,
    });
  }

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setForm({
      ...form,
      patientName: patient.patientName,
      hospitalNumber: patient.hospitalNumber,
      notes: patient.speciality
        ? `Speciality: ${patient.speciality}${patient.procedure ? `; Procedure: ${patient.procedure}` : ""}`
        : form.notes,
    });
    window.setTimeout(() => {
      patientEntryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function parseCsvLine(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === "\"" && inQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
      } else if (character === "\"") {
        inQuotes = !inQuotes;
      } else if (character === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }

    cells.push(current.trim());
    return cells;
  }

  function parsePatientCsv(text) {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseCsvLine);

    if (rows.length === 0) return [];

    const firstRowText = rows[0].join(" ").toLowerCase();
    const hasHeader =
      firstRowText.includes("patient") ||
      firstRowText.includes("mrn") ||
      firstRowText.includes("nhs");
    const headers = hasHeader
      ? rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ""))
      : [];
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const locationKey = String(device?.locationName || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

    function valueByHeader(row, names, fallbackIndex) {
      const index = headers.findIndex((header) =>
        names.some((name) => header.includes(name))
      );

      if (index >= 0) return row[index] || "";
      return row[fallbackIndex] || "";
    }

    return dataRows
      .map((row) => {
        const theatre = hasHeader
          ? valueByHeader(row, ["theatre", "location", "room"], 0)
          : "";
        const patientName = hasHeader
          ? valueByHeader(row, ["patientname", "patient"], theatre ? 1 : 0)
          : row[0];
        const hospitalNumber = hasHeader
          ? valueByHeader(row, ["mrn", "nhs", "hospitalnumber", "number"], theatre ? 2 : 1)
          : row[1];
        const speciality = hasHeader
          ? valueByHeader(row, ["speciality", "specialty"], theatre ? 3 : 2)
          : row[2];
        const procedure = hasHeader
          ? valueByHeader(row, ["procedure", "operation"], theatre ? 4 : 3)
          : row[3];
        const listDate = hasHeader
          ? valueByHeader(row, ["listdate", "date"], theatre ? 5 : 4)
          : row[4];
        const theatreKey = String(theatre || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");

        if (theatreKey && locationKey && theatreKey !== locationKey) {
          return null;
        }

        return {
          patientName,
          hospitalNumber,
          speciality: speciality || "",
          procedure: procedure || "",
          listDate: listDate || newPatient.listDate,
        };
      })
      .filter(Boolean)
      .filter((patient) => patient.patientName && patient.hospitalNumber);
  }

  function downloadSamplePatientCsv() {
    const today = new Date().toISOString().slice(0, 10);
    const theatre = device?.locationName || "TH5";
    const speciality = "Orthopaedics";
    const rows = [
      ["theatre", "patient name", "MRN / NHS number", "speciality", "procedure", "list date"],
      [theatre, "Amelia Roberts", "JR-100245", speciality, "Total hip replacement", today],
      [theatre, "Noah Wilson", "JR-100246", speciality, "Knee arthroscopy", today],
      [theatre, "Olivia Martin", "JR-100247", speciality, "Shoulder arthroscopy", today],
      [theatre, "Harry Thompson", "JR-100248", speciality, "Ankle fixation", today],
      [theatre, "Isla Walker", "JR-100249", speciality, "Carpal tunnel release", today],
      [theatre, "Daniel Evans", "JR-100250", speciality, "Wrist fixation", today],
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "sample-theatre-patient-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredPatients = patients.filter((patient) => {
    const searchText = [
      patient.patientName,
      patient.hospitalNumber,
      patient.speciality,
      patient.procedure,
      patient.listDate,
    ]
      .join(" ")
      .toLowerCase();

    return searchText.includes(patientSearch.toLowerCase());
  });
  const patientSpecialities = [
    ...new Set(
      patients
        .map((patient) => String(patient.speciality || "").trim())
        .filter(Boolean)
    ),
  ];
  const patientListTitle =
    patientSpecialities.length === 1
      ? `${device?.locationName || "Location"} - ${patientSpecialities[0]} List`
      : `${device?.locationName || "Current location"} Patient List`;
  const currentDrugRequests = locationPharmacyRequests.filter(
    (request) => Number(request.drugId) === Number(drug.id)
  );
  const openDrugRequests = currentDrugRequests.filter((request) =>
    ["REQUESTED", "APPROVED"].includes(String(request.status || "").toUpperCase())
  );

  async function addPatient(event) {
    event.preventDefault();
    setPatientMessage("");

    if (!device?.hospitalId || !device?.locationId) {
      setPatientMessage("Device location is required before adding patients");
      return;
    }

    if (!newPatient.patientName || !newPatient.hospitalNumber) {
      setPatientMessage("Patient name and MRN / NHS number are required");
      return;
    }

    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...newPatient,
        hospitalId: device.hospitalId,
        hospitalName: device.hospitalName,
        locationId: device.locationId,
        locationName: device.locationName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setPatientMessage(result.message || "Could not add patient");
      return;
    }

    setPatientMessage("Patient added");
    setNewPatient({
        patientName: "",
        hospitalNumber: "",
        speciality: "",
        procedure: "",
        listDate: today,
      });
    await loadPatients();
  }

  async function uploadPatientList(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPatientMessage("");

    const text = await file.text();
    const parsedPatients = parsePatientCsv(text);

    if (parsedPatients.length === 0) {
      setPatientMessage("No valid patients found in CSV");
      return;
    }

    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/patients/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        hospitalId: device.hospitalId,
        hospitalName: device.hospitalName,
        locationId: device.locationId,
        locationName: device.locationName,
        patients: parsedPatients,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setPatientMessage(result.message || "Could not upload patient list");
      return;
    }

    setPatientMessage(result.message || "Patient list uploaded");
    event.target.value = "";
    await loadPatients();
  }

  async function archiveTodayPatientList() {
    if (!patients.length) {
      setPatientMessage("No patients to archive for today");
      return;
    }

    const confirmed = window.confirm(
      `Archive today's patient list for ${device?.locationName || "this location"}?`
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/patients/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId: device.hospitalId,
          locationId: device.locationId,
          listDate: today,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setPatientMessage(result.message || "Could not archive patient list");
        return;
      }

      setSelectedPatient(null);
      setPatients([]);
      setPatientMessage(result.message || "Patient list archived");
    } catch {
      setPatientMessage("Could not archive patient list");
    }
  }

  function isAuthorisedClinicalStaff(roleValue) {
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

  function isDoctorOrAnaesthetistRole(roleValue) {
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

  function isBlockedSecondCheckerRole(roleValue) {
    return String(roleValue || "").toLowerCase() === "admin" || isDoctorOrAnaesthetistRole(roleValue);
  }

  async function verifyPharmacyRequestUser() {
    setPharmacyRequestMessage("");

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: pharmacyRequestLogin.username,
        password: pharmacyRequestLogin.password,
        currentUserId: null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setPharmacyRequestMessage(result.message || "Could not verify staff");
      setPharmacyRequestUser(null);
      return;
    }

    if (!isAuthorisedClinicalStaff(result.role)) {
      setPharmacyRequestMessage(
        "Only ODP, anaesthetic practitioner, theatre practitioner or nurse can request controlled drug pharmacy supply."
      );
      setPharmacyRequestUser(null);
      return;
    }

    setPharmacyRequestUser(result);
    setPharmacyRequestMessage(`✓ ${result.fullName || result.username} verified`);
  }

  async function sendPharmacyRequest() {
    setPharmacyRequestMessage("");

    if (!pharmacyRequestUser) {
      setPharmacyRequestMessage("Verify authorised staff before sending request");
      return;
    }

    if (
      !pharmacyRequestForm.quantityRequested ||
      Number(pharmacyRequestForm.quantityRequested) <= 0
    ) {
      setPharmacyRequestMessage("Enter quantity requested");
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/pharmacy-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: drug.id,
        quantityRequested: Number(pharmacyRequestForm.quantityRequested),
        reason: pharmacyRequestForm.reason,
        requestedById: pharmacyRequestUser.id,
        requestedByName: pharmacyRequestUser.fullName || pharmacyRequestUser.username,
        requestedByRole: pharmacyRequestUser.role,
        hospitalId: drug.hospitalId || null,
        hospitalName: drug.hospitalName || "",
        locationId: drug.locationId || null,
        locationName: drug.locationName || "",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setPharmacyRequestMessage(result.message || "Could not create pharmacy request");
      return;
    }

    setPharmacyRequestMessage(
      `✓ Pharmacy request created. Requisition number: ${result.request.requisitionNumber}`
    );

    setPharmacyRequestForm({ quantityRequested: "", reason: "Routine top up" });
    setPharmacyRequestLogin({ username: "", password: "" });
    setPharmacyRequestUser(null);
    await loadLocationPharmacyRequests();
  }

  async function verifySupplyRequisition() {
    setSupplyMessage("");
    setVerifiedRequisition(null);
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/pharmacy-requests/verify-requisition`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requisitionNumber: supplyForm.requisitionNumber,
        drugId: drug.id,
        quantityReceived: Number(supplyForm.ampoulesReceived || 0),
        hospitalId: device?.hospitalId,
        locationId: device?.locationId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSupplyMessage(result.message || "Could not verify requisition");
      return;
    }

    setVerifiedRequisition(result.request);
    setSupplyMessage(`✓ Requisition verified: ${result.request.requisitionNumber}`);
  }

  async function verifySupplyReceivedBy() {
    setSupplyMessage("");

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: supplyReceivedLogin.username,
        password: supplyReceivedLogin.password,
        currentUserId: null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSupplyMessage(result.message || "Could not verify receiving staff");
      setSupplyReceivedUser(null);
      return;
    }

    if (!isAuthorisedClinicalStaff(result.role)) {
      setSupplyMessage("Only authorised clinical staff can receive controlled drug stock.");
      setSupplyReceivedUser(null);
      return;
    }

    setSupplyReceivedUser(result);
    setSupplyMessage(`✓ Received by verified: ${result.fullName || result.username}`);
  }

  async function verifySupplyChecker() {
    setSupplyMessage("");

    if (!supplyReceivedUser) {
      setSupplyMessage("Verify receiving staff first");
      return;
    }

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: supplyCheckerLogin.username,
        password: supplyCheckerLogin.password,
        currentUserId: supplyReceivedUser.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSupplyMessage(result.message || "Could not verify checker");
      setSupplyCheckerUser(null);
      return;
    }

    if (!isAuthorisedClinicalStaff(result.role)) {
      setSupplyMessage("Only authorised clinical staff can check controlled drug stock.");
      setSupplyCheckerUser(null);
      return;
    }

    setSupplyCheckerUser(result);
    setSupplyMessage(`✓ Checked by verified: ${result.fullName || result.username}`);
  }

  function patientNewBalance() {
    return Number(balance || 0) - Number(form.ampoulesUsed || 0);
  }

  function supplyNewBalance() {
    return Number(balance || 0) + Number(supplyForm.ampoulesReceived || 0);
  }

  function parseNumberFromText(text) {
    if (!text) return 0;
    const match = String(text).match(/[\d.]+/);
    return match ? Number(match[0]) : 0;
  }

  function getDoseUnit() {
    const concentration = String(drug.concentration || "").toLowerCase();
    if (concentration.includes("mcg")) return "mcg";
    if (concentration.includes("mg")) return "mg";
    if (concentration.includes("ml")) return "ml";
    return form.administeredUnit || "mcg";
  }

  function amountPerAmpoule() {
    const concentrationValue = parseNumberFromText(drug.concentration);
    const volume = parseNumberFromText(drug.size);

    if (!concentrationValue || !volume) return 0;

    if (String(drug.concentration || "").includes("/ml")) {
      return concentrationValue * volume;
    }

    return concentrationValue;
  }

  function totalAvailableFromOpenedAmpoules() {
    return Number(form.ampoulesUsed || 0) * amountPerAmpoule();
  }

  function cleanNumber(value) {
    if (!value) return 0;
    const match = String(value).match(/[\d.]+/);
    return match ? Number(match[0]) : 0;
  }

  function totalAccountedFor() {
    return cleanNumber(form.amountAdministered) + cleanNumber(form.amountWasted);
  }

  function discrepancyAmount() {
    return totalAvailableFromOpenedAmpoules() - totalAccountedFor();
  }

  function isDoseBalanced() {
    if (!form.ampoulesUsed) return false;
    return Math.abs(discrepancyAmount()) < 0.0001;
  }

  async function saveSupplyEntry() {
    setSupplyMessage("");

    if (!verifiedRequisition) {
      setSupplyMessage("Verify requisition number first");
      return;
    }

    if (!supplyReceivedUser) {
      setSupplyMessage("Verify receiving staff first");
      return;
    }

    if (!supplyCheckerUser) {
      setSupplyMessage("Verify checking staff first");
      return;
    }

    if (Number(supplyReceivedUser.id) === Number(supplyCheckerUser.id)) {
      setSupplyMessage("Received by and checked by must be two different staff members");
      return;
    }

    const token = localStorage.getItem("token");
    const received = Number(supplyForm.ampoulesReceived || 0);

    const response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: drug.id,
        drugName: drug.name,
        hospitalId: device?.hospitalId,
        hospitalName: device?.hospitalName,
        locationId: device?.locationId,
        locationName: device?.locationName,
        patientName: "",
        hospitalNumber: "",
        ampoulesSupplied: received,
        ampoulesUsed: 0,
        amountAdministered: 0,
        administeredUnit: "",
        amountWasted: 0,
        wastedUnit: "",
        administeredById: supplyReceivedUser.id,
        administeredByName: supplyReceivedUser.fullName || supplyReceivedUser.username,
        administeredSignature: supplyReceivedUser.username,
        witnessId: supplyCheckerUser.id,
        witnessName: supplyCheckerUser.fullName || supplyCheckerUser.username,
        witnessSignature: supplyCheckerUser.username,
        notes: `Pharmacy stock received. Requisition: ${verifiedRequisition.requisitionNumber}`,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setSupplyMessage(result.message || "Could not add pharmacy supply");
      return;
    }

    const completeResponse = await fetch(
      `${API_URL}/pharmacy-requests/${verifiedRequisition.id}/complete`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const completeResult = await completeResponse.json();

    if (!completeResponse.ok) {
      setSupplyMessage(completeResult.message || "Stock added but requisition was not completed");
      return;
    }

    setSupplyMessage(
      `✓ Pharmacy supply added and requisition completed: ${verifiedRequisition.requisitionNumber}`
    );

    setSupplyForm({ ampoulesReceived: "", requisitionNumber: "" });
    setSupplyReceivedLogin({ username: "", password: "" });
    setSupplyCheckerLogin({ username: "", password: "" });
    setSupplyReceivedUser(null);
    setSupplyCheckerUser(null);
    setVerifiedRequisition(null);
    setShowSupplyForm(false);

    await loadTransactions();
    await loadLocationPharmacyRequests();
  }
    async function verifyAdministeredBy() {
    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminForm.username,
        password: adminForm.password,
        currentUserId: null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      setAdministeredUser(null);
      return;
    }

    if (String(result.role || "").toLowerCase() === "admin") {
      alert("Admin account cannot be used as the administering clinician.");
      setAdministeredUser(null);
      return;
    }

    setAdministeredUser(result);
    alert(`Administered by verified: ${result.fullName}`);
  }

  async function verifySecondChecker() {
    if (!administeredUser) {
      alert("Verify the administering staff first.");
      return;
    }

    const response = await fetch(`${API_URL}/checker/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: checkerForm.username,
        password: checkerForm.password,
        currentUserId: administeredUser.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      setCheckerUser(null);
      return;
    }

    if (isBlockedSecondCheckerRole(result.role)) {
      alert("Second checker must be ODP, anaesthetic practitioner, theatre practitioner or nurse.");
      setCheckerUser(null);
      return;
    }

    setCheckerUser(result);
    alert(`Second checker verified: ${result.fullName}`);
  }

  async function savePatientEntry() {
    if (!administeredUser) {
      alert("Administered by staff must be verified first.");
      return;
    }

    if (!checkerUser) {
      alert("Second checker must be verified before saving.");
      return;
    }

    if (Number(administeredUser.id) === Number(checkerUser.id)) {
      alert("Same person cannot administer and check.");
      return;
    }

    if (patientNewBalance() < 0) {
      alert("Not enough stock");
      return;
    }

    if (!isDoseBalanced()) {
      alert(
        `Dose mismatch. Opened ampoules contain ${totalAvailableFromOpenedAmpoules()} ${getDoseUnit()}, but administered + wasted = ${totalAccountedFor()} ${getDoseUnit()}.`
      );
      return;
    }

    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        drugId: drug.id,
        drugName: drug.name,
        hospitalId: device?.hospitalId,
        hospitalName: device?.hospitalName,
        locationId: device?.locationId,
        locationName: device?.locationName,
        patientName: form.patientName,
        hospitalNumber: form.hospitalNumber,
        ampoulesSupplied: 0,
        ampoulesUsed: Number(form.ampoulesUsed || 0),
        amountAdministered: cleanNumber(form.amountAdministered),
        administeredUnit: getDoseUnit(),
        amountWasted: cleanNumber(form.amountWasted),
        wastedUnit: getDoseUnit(),
        administeredById: administeredUser.id,
        administeredByName:
          administeredUser.fullName || administeredUser.username,
        administeredSignature: administeredUser.username,
        witnessId: checkerUser.id,
        witnessName: checkerUser.fullName || checkerUser.username,
        witnessSignature: checkerUser.username,
        notes: form.notes,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message);
      return;
    }

    if (result.reorderRequired) {
      alert("⚠️ Stock below 5 ampoules. Reorder from pharmacy.");
    }

    setForm({
      patientName: "",
      hospitalNumber: "",
      ampoulesUsed: "",
      amountAdministered: "",
      administeredUnit: "mcg",
      amountWasted: "",
      wastedUnit: "mcg",
      notes: "",
    });

    setAdminForm({ username: "", password: "" });
    setCheckerForm({ username: "", password: "" });
    setAdministeredUser(null);
    setCheckerUser(null);
    setSelectedPatient(null);

    await loadTransactions();
  }

  return (
    <div className="register-box">
      <button onClick={onClose}>← Back to Drugs</button>

      <h2>📖 {drug.name} Register</h2>

      <p>
        <strong>Size:</strong> {drug.size} |{" "}
        <strong>Concentration:</strong> {drug.concentration}
      </p>

      <h2>Current Balance: {balance} ampoules</h2>

      <h3>Patient List - {device?.locationName || "Current Location"}</h3>

      <section className="patient-list-panel">
        <div className="patient-list-toolbar">
          <div>
            <strong>{patientListTitle}</strong>
            <span>
              Today: {today} · {patients.length} patient{patients.length === 1 ? "" : "s"} loaded
            </span>
          </div>

          <div className="patient-list-actions">
            <button type="button" onClick={downloadSamplePatientCsv}>
              Download Sample CSV
            </button>

            <button
              type="button"
              className="archive-list-btn"
              onClick={archiveTodayPatientList}
            >
              Archive Today’s List
            </button>
          </div>
        </div>

        <p>
          CSV columns: theatre, patient name, MRN / NHS number, speciality,
          procedure, list date. This list is saved only for the current
          hospital/location. Old dated lists disappear automatically from the
          normal view after their list date.
        </p>

        {patientSpecialities.length > 1 && (
          <strong className="patient-list-warning">
            This uploaded list has more than one speciality. Upload one theatre
            session/speciality at a time.
          </strong>
        )}

        <input type="file" accept=".csv,text/csv" onChange={uploadPatientList} />

        <input
          placeholder="Search patient, MRN, speciality or procedure"
          value={patientSearch}
          onChange={(event) => setPatientSearch(event.target.value)}
        />
      </section>

      <form onSubmit={addPatient}>
        <input
          name="patientName"
          placeholder="Patient name"
          value={newPatient.patientName}
          onChange={updateNewPatient}
        />

        <input
          name="hospitalNumber"
          placeholder="MRN / NHS / private hospital number"
          value={newPatient.hospitalNumber}
          onChange={updateNewPatient}
        />

        <input
          name="speciality"
          placeholder="Speciality e.g. Orthopaedics, ENT, ICU"
          value={newPatient.speciality}
          onChange={updateNewPatient}
        />

        <input
          name="procedure"
          placeholder="Procedure / operation"
          value={newPatient.procedure}
          onChange={updateNewPatient}
        />

        <input
          type="date"
          name="listDate"
          value={newPatient.listDate}
          onChange={updateNewPatient}
        />

        <button type="submit">Add Patient To This Area</button>
      </form>

      {patientMessage && (
        <p
          style={{
            color: patientMessage.includes("Could") || patientMessage.includes("No valid")
              ? "red"
              : "green",
            fontWeight: "bold",
          }}
        >
          {patientMessage}
        </p>
      )}

      {selectedPatient && (
        <div className="selected-patient-banner">
          <span>Selected patient</span>
          <strong>{selectedPatient.patientName}</strong>
          <small>
            {selectedPatient.hospitalNumber} · {selectedPatient.speciality || "Speciality not set"}
            {selectedPatient.procedure ? ` · ${selectedPatient.procedure}` : ""}
          </small>
        </div>
      )}

      {patients.length > 0 && (
        <div className="patient-card-grid">
          {filteredPatients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className={
                selectedPatient?.id === patient.id
                  ? "patient-card selected"
                  : "patient-card"
              }
              onClick={() => selectPatient(patient)}
            >
              <strong>{patient.patientName}</strong>
              <span>{device?.locationName || "Location"} · {patient.hospitalNumber}</span>
              <small>{patient.speciality || "Speciality not set"}</small>
              <small>{patient.procedure || "Procedure not set"}</small>
              <em>{patient.listDate || "-"}</em>
            </button>
          ))}
        </div>
      )}

      {patients.length > 0 && filteredPatients.length === 0 && (
        <p style={{ fontWeight: "bold" }}>
          No patients match this search.
        </p>
      )}

      {balance < REORDER_LEVEL && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ LOW STOCK — order from pharmacy
        </p>
      )}

      <section className="drug-request-status-panel">
        <div>
          <strong>Pharmacy requests for {drug.name}</strong>
          <span>
            {openDrugRequests.length > 0
              ? `${openDrugRequests.length} pending/approved request${openDrugRequests.length === 1 ? "" : "s"}`
              : "No pending or approved request for this drug"}
          </span>
        </div>

        {openDrugRequests.length > 0 && (
          <div className="drug-request-status-list">
            {openDrugRequests.map((request) => (
              <article key={request.id}>
                <strong>{request.requisitionNumber}</strong>
                <span>{request.status}</span>
                <small>
                  {request.quantityRequested} ampoules ·{" "}
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleString()
                    : "-"}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setShowPharmacyRequest(!showPharmacyRequest)}
      >
        {showPharmacyRequest ? "Hide Pharmacy Request" : "📩 Request Pharmacy Stock"}
      </button>

      {showPharmacyRequest && (
        <>
          <h3>📩 Pharmacy Stock Request</h3>

          <input value={`Current balance: ${balance} ampoules`} disabled />

          <input
            type="number"
            name="quantityRequested"
            placeholder="Quantity requested from pharmacy"
            value={pharmacyRequestForm.quantityRequested}
            onChange={updatePharmacyRequestForm}
          />

          <select
            name="reason"
            value={pharmacyRequestForm.reason}
            onChange={updatePharmacyRequestForm}
          >
            <option>Routine top up</option>
            <option>Low stock</option>
            <option>Weekend / Bank Holiday cover</option>
            <option>High theatre activity</option>
            <option>Emergency request</option>
            <option>Other</option>
          </select>

          <h4>Authorised Staff Verification</h4>

          <input
            name="username"
            placeholder="Authorised staff username"
            value={pharmacyRequestLogin.username}
            onChange={updatePharmacyRequestLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Authorised staff password"
            value={pharmacyRequestLogin.password}
            onChange={updatePharmacyRequestLogin}
          />

          <button type="button" onClick={verifyPharmacyRequestUser}>
            Verify Authorised Staff
          </button>

          {pharmacyRequestUser && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✓ {pharmacyRequestUser.fullName || pharmacyRequestUser.username} verified
            </p>
          )}

          <button type="button" onClick={sendPharmacyRequest}>
            Sign & Create Pharmacy Request
          </button>

          {pharmacyRequestMessage && (
            <p
              style={{
                fontWeight: "bold",
                color: pharmacyRequestMessage.includes("✓") ? "green" : "red",
              }}
            >
              {pharmacyRequestMessage}
            </p>
          )}

          <hr />
        </>
      )}

      <button
        type="button"
        onClick={() => setShowSupplyForm(!showSupplyForm)}
      >
        {showSupplyForm ? "Hide Pharmacy Stock Supply" : "📦 Receive Pharmacy Stock"}
      </button>

      {showSupplyForm && (
        <>
          <h3>📦 Pharmacy Stock Supply</h3>

          <input value={`Current balance: ${balance} ampoules`} disabled />

          <input
            type="number"
            name="ampoulesReceived"
            placeholder="Ampoules received from pharmacy"
            value={supplyForm.ampoulesReceived}
            onChange={updateSupplyForm}
          />

          <input value={`Balance after supply: ${supplyNewBalance()} ampoules`} disabled />

          <input
            name="requisitionNumber"
            placeholder="Requisition number from pharmacy"
            value={supplyForm.requisitionNumber}
            onChange={updateSupplyForm}
          />

          <button type="button" onClick={verifySupplyRequisition}>
            Verify Requisition Number
          </button>

          {verifiedRequisition && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✓ Requisition matched: {verifiedRequisition.requisitionNumber}
            </p>
          )}

          <h4>Received By Verification</h4>

          <input
            name="username"
            placeholder="Receiving staff username"
            value={supplyReceivedLogin.username}
            onChange={updateSupplyReceivedLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Receiving staff password"
            value={supplyReceivedLogin.password}
            onChange={updateSupplyReceivedLogin}
          />

          <button type="button" onClick={verifySupplyReceivedBy}>
            Verify Received By
          </button>

          {supplyReceivedUser && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✓ Received by verified: {supplyReceivedUser.fullName || supplyReceivedUser.username}
            </p>
          )}

          <h4>Checked By Verification</h4>

          <input
            name="username"
            placeholder="Checking staff username"
            value={supplyCheckerLogin.username}
            onChange={updateSupplyCheckerLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Checking staff password"
            value={supplyCheckerLogin.password}
            onChange={updateSupplyCheckerLogin}
          />

          <button type="button" onClick={verifySupplyChecker}>
            Verify Checked By
          </button>

          {supplyCheckerUser && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✓ Checked by verified: {supplyCheckerUser.fullName || supplyCheckerUser.username}
            </p>
          )}

          {supplyMessage && (
            <p
              style={{
                color: supplyMessage.includes("✓") ? "green" : "red",
                fontWeight: "bold",
              }}
            >
              {supplyMessage}
            </p>
          )}

          <button type="button" onClick={saveSupplyEntry}>
            ➕ Add Pharmacy Supply
          </button>

          <hr />
        </>
      )}

      <h3 ref={patientEntryRef}>👤 Patient Drug Register Entry</h3>

      {selectedPatient && (
        <p className="selected-patient-inline">
          Using {selectedPatient.patientName} for this entry. Complete the drug
          details below, then verify with two different authorised staff.
        </p>
      )}

      <input
        name="patientName"
        placeholder="Patient name"
        value={form.patientName}
        onChange={updateForm}
      />

      <input
        name="hospitalNumber"
        placeholder="Hospital number / MRN / NHS No."
        value={form.hospitalNumber}
        onChange={updateForm}
      />

      <h3>Stock Used For Patient</h3>

      <input value={`Previous balance: ${balance} ampoules`} disabled />

      <input
        name="ampoulesUsed"
        placeholder="Ampoules opened / used"
        value={form.ampoulesUsed}
        onChange={updateForm}
      />

      <input value={`New balance: ${patientNewBalance()} ampoules`} disabled />

      {patientNewBalance() < REORDER_LEVEL && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ Reorder required from pharmacy
        </p>
      )}

      <h3>Dose Reconciliation</h3>

      <input value={`Amount per ampoule: ${amountPerAmpoule()} ${getDoseUnit()}`} disabled />
      <input value={`Opened ampoules total: ${totalAvailableFromOpenedAmpoules()} ${getDoseUnit()}`} disabled />

      <h3>Dose Given / Wasted</h3>

      <input
        name="amountAdministered"
        placeholder="Amount administered"
        value={form.amountAdministered}
        onChange={updateForm}
      />

      <select
        name="administeredUnit"
        value={form.administeredUnit}
        onChange={updateForm}
      >
        <option>mcg</option>
        <option>mg</option>
        <option>ml</option>
      </select>

      <input
        name="amountWasted"
        placeholder="Amount wasted"
        value={form.amountWasted}
        onChange={updateForm}
      />

      <select
        name="wastedUnit"
        value={form.wastedUnit}
        onChange={updateForm}
      >
        <option>mcg</option>
        <option>mg</option>
        <option>ml</option>
      </select>

      <input value={`Administered + wasted: ${totalAccountedFor()} ${getDoseUnit()}`} disabled />
      <input value={`Discrepancy: ${discrepancyAmount()} ${getDoseUnit()}`} disabled />

      {form.ampoulesUsed && (
        <p style={{ color: isDoseBalanced() ? "green" : "red", fontWeight: "bold" }}>
          {isDoseBalanced()
            ? "✓ Dose fully accounted for"
            : "⚠️ Administered + wasted does not match opened ampoule amount"}
        </p>
      )}

      <h3>Administered By Verification</h3>

      <input
        name="username"
        placeholder="Administering staff username"
        value={adminForm.username}
        onChange={updateAdminForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Administering staff password"
        value={adminForm.password}
        onChange={updateAdminForm}
      />

      <button type="button" onClick={verifyAdministeredBy}>
        Verify Administered By
      </button>

      {administeredUser && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Administered by verified: {administeredUser.fullName} ({administeredUser.role})
        </p>
      )}

      <h3>Second Checker Verification</h3>

      <input
        name="username"
        placeholder="Checker username"
        value={checkerForm.username}
        onChange={updateCheckerForm}
      />

      <input
        name="password"
        type="password"
        placeholder="Checker password"
        value={checkerForm.password}
        onChange={updateCheckerForm}
      />

      <button type="button" onClick={verifySecondChecker}>
        Verify Second Checker
      </button>

      {checkerUser && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✓ Second checker verified: {checkerUser.fullName} ({checkerUser.role})
        </p>
      )}

      <input
        name="notes"
        placeholder="Notes"
        value={form.notes}
        onChange={updateForm}
      />

      <button type="button" onClick={savePatientEntry}>
        💾 Save Patient Entry
      </button>

      <h3>Register Entries</h3>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Patient</th>
            <th>MRN / NHS No.</th>
            <th>Received</th>
            <th>Used</th>
            <th>Given</th>
            <th>Waste</th>
            <th>Balance After</th>
            <th>Staff</th>
            <th>Staff Signature</th>
            <th>Witness</th>
            <th>Witness Signature</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((entry) => {
            const isCorrection = entry.transactionType === "CORRECTION";

            const isSupply =
              !isCorrection &&
              Number(entry.ampoulesSupplied || 0) > 0 &&
              Number(entry.ampoulesUsed || 0) === 0;

            return (
              <tr key={entry.id}>
                <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</td>
                <td>{isCorrection ? "CORRECTION" : isSupply ? "Pharmacy Supply" : "Patient Use"}</td>
                <td>{isCorrection ? "-" : entry.patientName || "-"}</td>
                <td>{isCorrection ? "-" : entry.hospitalNumber || "-"}</td>
                <td>
                  {isCorrection && Number(entry.ampoulesSupplied || 0) > 0
                    ? `+${entry.ampoulesSupplied}`
                    : entry.ampoulesSupplied}
                </td>
                <td>{isCorrection ? "-" : entry.ampoulesUsed}</td>
                <td>{isCorrection ? "-" : `${entry.amountAdministered || ""}${entry.administeredUnit || ""}`}</td>
                <td>{isCorrection ? "-" : `${entry.amountWasted || ""}${entry.wastedUnit || ""}`}</td>
                <td>{entry.stockBalanceAfter}</td>
                <td>{entry.administeredByName}</td>
                <td>{entry.administeredSignature || "-"}</td>
                <td>{entry.witnessName}</td>
                <td>{entry.witnessSignature || "-"}</td>
                <td>{entry.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DrugRegister;
