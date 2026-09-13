import { useEffect, useRef, useState } from "react";
import PatientListPanel from "./drugRegister/PatientListPanel";
import PharmacyStockPanel from "./drugRegister/PharmacyStockPanel";
import { parsePatientFile } from "./drugRegister/patientListImport";

import { API_URL } from "../apiConfig";
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

  function downloadSamplePatientList() {
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

    setPatientMessage(`Reading ${file.name}...`);

    let parsedPatients = [];

    try {
      parsedPatients = await parsePatientFile(file, newPatient.listDate || today);
    } catch {
      setPatientMessage("Could not read this patient list file");
      event.target.value = "";
      return;
    }

    if (parsedPatients.length === 0) {
      setPatientMessage(
        "No valid patients found. Use columns: theatre, patient name, MRN / NHS number, speciality, procedure, list date."
      );
      event.target.value = "";
      return;
    }

    setPatientMessage(`Uploading ${parsedPatients.length} patient${parsedPatients.length === 1 ? "" : "s"}...`);

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

    await loadPatients();
    setPatientMessage(
      `${result.message || "Patient list uploaded"}. Showing today's list for ${device?.locationName || "this location"}.`
    );
    event.target.value = "";
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
        hospitalId: device?.hospitalId || null,
        hospitalName: device?.hospitalName || "",
        locationId: device?.locationId || null,
        locationName: device?.locationName || "",
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

    if (String(result.role || "").toLowerCase() === "admin") {
      alert("Admin account cannot be used as the witness / second signature.");
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
    <div className="register-box drug-register-screen" data-drug-name={drug.name}>
      <section className="drug-register-header">
        <button type="button" className="back-to-drugs-btn" onClick={onClose}>
          Back to Drugs
        </button>

        <div>
          <span className="eyebrow">Selected controlled drug</span>
          <h2>{drug.name}</h2>
          <p>
            {drug.size} | {drug.concentration}
          </p>
        </div>

        <div className="drug-balance-pill">
          <strong>{balance}</strong>
          <span>ampoules</span>
        </div>
      </section>

      <PatientListPanel
        device={device}
        today={today}
        patients={patients}
        filteredPatients={filteredPatients}
        selectedPatient={selectedPatient}
        patientListTitle={patientListTitle}
        patientSpecialities={patientSpecialities}
        patientSearch={patientSearch}
        patientMessage={patientMessage}
        newPatient={newPatient}
        onArchiveTodayPatientList={archiveTodayPatientList}
        onAddPatient={addPatient}
        onDownloadSamplePatientList={downloadSamplePatientList}
        onPatientSearchChange={setPatientSearch}
        onSelectPatient={selectPatient}
        onUpdateNewPatient={updateNewPatient}
        onUploadPatientList={uploadPatientList}
      />

      {balance < REORDER_LEVEL && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ⚠️ LOW STOCK — order from pharmacy
        </p>
      )}

      <PharmacyStockPanel
        balance={balance}
        drug={drug}
        openDrugRequests={openDrugRequests}
        pharmacyRequestForm={pharmacyRequestForm}
        pharmacyRequestLogin={pharmacyRequestLogin}
        pharmacyRequestMessage={pharmacyRequestMessage}
        pharmacyRequestUser={pharmacyRequestUser}
        showPharmacyRequest={showPharmacyRequest}
        showSupplyForm={showSupplyForm}
        supplyCheckerLogin={supplyCheckerLogin}
        supplyCheckerUser={supplyCheckerUser}
        supplyForm={supplyForm}
        supplyMessage={supplyMessage}
        supplyNewBalance={supplyNewBalance}
        supplyReceivedLogin={supplyReceivedLogin}
        supplyReceivedUser={supplyReceivedUser}
        verifiedRequisition={verifiedRequisition}
        onSaveSupplyEntry={saveSupplyEntry}
        onSendPharmacyRequest={sendPharmacyRequest}
        onTogglePharmacyRequest={() => setShowPharmacyRequest(!showPharmacyRequest)}
        onToggleSupplyForm={() => setShowSupplyForm(!showSupplyForm)}
        onUpdatePharmacyRequestForm={updatePharmacyRequestForm}
        onUpdatePharmacyRequestLogin={updatePharmacyRequestLogin}
        onUpdateSupplyCheckerLogin={updateSupplyCheckerLogin}
        onUpdateSupplyForm={updateSupplyForm}
        onUpdateSupplyReceivedLogin={updateSupplyReceivedLogin}
        onVerifyPharmacyRequestUser={verifyPharmacyRequestUser}
        onVerifySupplyChecker={verifySupplyChecker}
        onVerifySupplyReceivedBy={verifySupplyReceivedBy}
        onVerifySupplyRequisition={verifySupplyRequisition}
      />

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
            const hasCorrection = Number(entry.correctionCount || 0) > 0;

            const isSupply =
              !isCorrection &&
              Number(entry.ampoulesSupplied || 0) > 0 &&
              Number(entry.ampoulesUsed || 0) === 0;

            return (
              <tr key={entry.id}>
                <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</td>
                <td>
                  {isCorrection ? "CORRECTION" : isSupply ? "Pharmacy Supply" : "Patient Use"}
                  {hasCorrection && (
                    <>
                      <br />
                      <span
                        className={
                          entry.latestCorrectionType === "entry_error"
                            ? "status-badge danger"
                            : "status-badge warning"
                        }
                      >
                        {entry.latestCorrectionType === "entry_error"
                          ? "Reversed"
                          : "Corrected"}
                      </span>
                    </>
                  )}
                </td>
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
                <td>
                  {entry.notes}
                  {hasCorrection && (
                    <>
                      <br />
                      <small>
                        Correction: {entry.latestCorrectionReason || "See correction history"}
                      </small>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DrugRegister;
