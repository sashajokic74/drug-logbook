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

      <form onSubmit={onAddPatient}>
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
