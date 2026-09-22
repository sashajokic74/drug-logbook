import { useEffect, useRef, useState } from "react";

function PatientListPanel({
  device,
  today,
  patients,
  filteredPatients,
  selectedPatient,
  patientListTitle,
  patientSpecialities,
  patientSearch,
  patientMessage,
  newPatient,
  onArchiveTodayPatientList,
  onAddPatient,
  onDownloadSamplePatientList,
  onPatientSearchChange,
  onSelectPatient,
  onUpdateNewPatient,
  onUploadPatientList,
}) {
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeMessage, setBarcodeMessage] = useState("");
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanActiveRef = useRef(false);

  useEffect(() => {
    return () => stopCameraScanner(false);
  }, []);

  function normaliseIdentifier(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function updateManualPatientField(name, value) {
    onUpdateNewPatient({
      target: { name, value },
    });
  }

  function findPatientByBarcode(code) {
    const normalisedCode = normaliseIdentifier(code);
    if (!normalisedCode) return null;

    return patients.find((patient) => {
      const hospitalNumber = normaliseIdentifier(patient.hospitalNumber);
      if (!hospitalNumber) return false;

      return (
        hospitalNumber === normalisedCode ||
        (hospitalNumber.length >= 5 && normalisedCode.includes(hospitalNumber)) ||
        (normalisedCode.length >= 5 && hospitalNumber.includes(normalisedCode))
      );
    });
  }

  function handleBarcodeLookup(rawValue = barcodeValue) {
    const code = String(rawValue || "").trim();

    if (!code) {
      setBarcodeMessage("Scan or enter the patient MRN / NHS / private hospital number");
      return;
    }

    const matchedPatient = findPatientByBarcode(code);

    if (matchedPatient) {
      onPatientSearchChange("");
      onSelectPatient(matchedPatient);
      setBarcodeValue("");
      setBarcodeMessage(
        `Matched ${matchedPatient.patientName} from today's ${device?.locationName || "location"} list`
      );
      return;
    }

    onPatientSearchChange(code);
    updateManualPatientField("hospitalNumber", code);
    setBarcodeMessage(
      "Patient not found on today's list. Check identity, then complete manual patient details before adding."
    );
  }

  function stopCameraScanner(updateState = true) {
    scanActiveRef.current = false;

    if (updateState) {
      setIsCameraScanning(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCameraScanner() {
    setBarcodeMessage("");

    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setBarcodeMessage(
        "Camera barcode scanning is not available in this browser. Use the barcode/MRN box instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const detector = new window.BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "qr_code", "data_matrix"],
      });

      streamRef.current = stream;
      scanActiveRef.current = true;
      setIsCameraScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      async function scanFrame() {
        if (!scanActiveRef.current || !videoRef.current) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          const firstBarcode = barcodes[0]?.rawValue;

          if (firstBarcode) {
            setBarcodeValue(firstBarcode);
            handleBarcodeLookup(firstBarcode);
            stopCameraScanner();
            return;
          }
        } catch {
          setBarcodeMessage("Could not read the barcode. Try again or enter MRN manually.");
        }

        window.requestAnimationFrame(scanFrame);
      }

      window.requestAnimationFrame(scanFrame);
    } catch {
      stopCameraScanner();
      setBarcodeMessage(
        "Camera could not be opened. Check iPad camera permission or enter the MRN manually."
      );
    }
  }

  return (
    <>
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
            <button type="button" onClick={onDownloadSamplePatientList}>
              Download Sample List
            </button>

            <button
              type="button"
              className="archive-list-btn"
              onClick={onArchiveTodayPatientList}
            >
              Archive Today’s List
            </button>
          </div>
        </div>

        <p>
          Upload Excel or CSV with columns: theatre, patient name, MRN / NHS number, speciality,
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

        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,text/csv,text/tab-separated-values"
          onChange={onUploadPatientList}
        />

        <input
          placeholder="Search patient, MRN, speciality or procedure"
          value={patientSearch}
          onChange={(event) => onPatientSearchChange(event.target.value)}
        />
      </section>

      <section className="patient-barcode-panel">
        <div className="patient-barcode-title">
          <span className="eyebrow">Patient barcode lookup</span>
          <strong>Scan wristband or enter MRN / NHS number</strong>
          <small>
            This searches today&apos;s uploaded list first. If there is no match,
            complete manual patient details before adding.
          </small>
        </div>

        <div className="patient-barcode-controls">
          <input
            inputMode="text"
            placeholder="Scan or type patient barcode / MRN"
            value={barcodeValue}
            onChange={(event) => setBarcodeValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleBarcodeLookup();
              }
            }}
          />

          <button type="button" onClick={() => handleBarcodeLookup()}>
            Find Patient
          </button>

          <button
            type="button"
            className={isCameraScanning ? "archive-list-btn" : ""}
            onClick={isCameraScanning ? stopCameraScanner : startCameraScanner}
          >
            {isCameraScanning ? "Stop Camera" : "Scan With Camera"}
          </button>
        </div>

        {isCameraScanning && (
          <video
            ref={videoRef}
            className="patient-barcode-video"
            muted
            playsInline
            aria-label="Patient barcode camera scanner"
          />
        )}

        {barcodeMessage && (
          <p
            className={
              barcodeMessage.includes("not found") ||
              barcodeMessage.includes("not available") ||
              barcodeMessage.includes("could not") ||
              barcodeMessage.includes("Could not")
                ? "patient-barcode-message warning"
                : "patient-barcode-message success"
            }
          >
            {barcodeMessage}
          </p>
        )}
      </section>

      <form className="patient-manual-entry" onSubmit={onAddPatient}>
        <div className="patient-manual-entry-title">
          <span className="eyebrow">Manual patient entry</span>
          <strong>Add patient to this theatre list</strong>
        </div>

        <input
          name="patientName"
          placeholder="Patient name"
          value={newPatient.patientName}
          onChange={onUpdateNewPatient}
        />

        <input
          name="hospitalNumber"
          placeholder="MRN / NHS / private hospital number"
          value={newPatient.hospitalNumber}
          onChange={onUpdateNewPatient}
        />

        <input
          name="speciality"
          placeholder="Speciality e.g. Orthopaedics, ENT, ICU"
          value={newPatient.speciality}
          onChange={onUpdateNewPatient}
        />

        <input
          name="procedure"
          placeholder="Procedure / operation"
          value={newPatient.procedure}
          onChange={onUpdateNewPatient}
        />

        <input
          type="date"
          name="listDate"
          value={newPatient.listDate}
          onChange={onUpdateNewPatient}
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
              onClick={() => onSelectPatient(patient)}
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
    </>
  );
}

export default PatientListPanel;
