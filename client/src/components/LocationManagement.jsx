import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function LocationManagement() {
  const [hospitals, setHospitals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [message, setMessage] = useState("");

  const [hospitalName, setHospitalName] = useState("");

  const [locationForm, setLocationForm] = useState({
    hospitalId: "",
    name: "",
    type: "Theatre",
  });

  useEffect(() => {
    loadHospitals();
    loadLocations();
  }, []);

  async function loadHospitals() {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/locations/hospitals`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not load hospitals");
        return;
      }

      setHospitals(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Server not running");
    }
  }

  async function loadLocations() {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not load locations");
        return;
      }

      setLocations(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Server not running");
    }
  }

  async function createHospital(event) {
    event.preventDefault();
    setMessage("");

    if (!hospitalName.trim()) {
      setMessage("Hospital name is required");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/locations/hospitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: hospitalName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not create hospital");
        return;
      }

      setMessage(`Hospital created: ${data.name}`);
      setHospitalName("");

      await loadHospitals();
    } catch {
      setMessage("Server not running");
    }
  }

  function updateLocationForm(event) {
    setLocationForm({
      ...locationForm,
      [event.target.name]: event.target.value,
    });
  }

  async function createLocation(event) {
    event.preventDefault();
    setMessage("");

    if (!locationForm.hospitalId || !locationForm.name.trim()) {
      setMessage("Hospital and location name are required");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId: Number(locationForm.hospitalId),
          name: locationForm.name.trim(),
          type: locationForm.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not create location");
        return;
      }

      setMessage(`Location created: ${data.hospitalName} — ${data.name}`);

      setLocationForm({
        hospitalId: locationForm.hospitalId,
        name: "",
        type: "Theatre",
      });

      await loadLocations();
    } catch {
      setMessage("Server not running");
    }
  }

  async function deactivateLocation(id) {
    const confirmDeactivate = window.confirm("Deactivate this location?");

    if (!confirmDeactivate) return;

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/locations/${id}/deactivate`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not deactivate location");
        return;
      }

      setMessage("Location deactivated");
      await loadLocations();
    } catch {
      setMessage("Server not running");
    }
  }

  return (
    <section
      style={{
        maxWidth: "1100px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        background: "#ffffff",
      }}
    >
      <h2>🏥 Hospital & Location Management</h2>

      <p>
        Create the hospital first, then add theatres, recovery rooms, or other
        controlled-drug stock areas.
      </p>

      <form
        onSubmit={createHospital}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "10px",
          marginBottom: "25px",
        }}
      >
        <input
          placeholder="Hospital name, e.g. Oxford University Hospitals"
          value={hospitalName}
          onChange={(event) => setHospitalName(event.target.value)}
        />

        <button type="submit">Create Hospital</button>
      </form>

      <form
        onSubmit={createLocation}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: "10px",
          marginBottom: "25px",
        }}
      >
        <select
          name="hospitalId"
          value={locationForm.hospitalId}
          onChange={updateLocationForm}
        >
          <option value="">Select hospital</option>

          {hospitals.map((hospital) => (
            <option key={hospital.id} value={hospital.id}>
              {hospital.name}
            </option>
          ))}
        </select>

        <input
          name="name"
          placeholder="Location name, e.g. Theatre 1"
          value={locationForm.name}
          onChange={updateLocationForm}
        />

        <select
          name="type"
          value={locationForm.type}
          onChange={updateLocationForm}
        >
          <option>Theatre</option>
          <option>Recovery</option>
          <option>Obstetric Theatre</option>
          <option>Emergency Theatre</option>
          <option>Day Surgery</option>
          <option>Pharmacy</option>
          <option>Other</option>
        </select>

        <button type="submit">Create Location</button>
      </form>

      {message && (
        <p
          style={{
            fontWeight: "bold",
            color:
              message.includes("created") || message.includes("deactivated")
                ? "green"
                : "red",
          }}
        >
          {message}
        </p>
      )}

      <h3>Hospitals</h3>

      <table style={{ width: "100%", marginBottom: "30px" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Hospital</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {hospitals.map((hospital) => (
            <tr key={hospital.id}>
              <td>{hospital.id}</td>
              <td>{hospital.name}</td>
              <td>{hospital.active === 0 ? "Inactive" : "Active"}</td>
              <td>{hospital.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Locations / Stock Areas</h3>

      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Hospital</th>
            <th>Location</th>
            <th>Type</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {locations.map((location) => (
            <tr key={location.id}>
              <td>{location.id}</td>
              <td>{location.hospitalName}</td>
              <td>{location.name}</td>
              <td>{location.type}</td>
              <td>{location.active === 0 ? "Inactive" : "Active"}</td>
              <td>{location.createdAt}</td>
              <td>
                <button
                  type="button"
                  onClick={() => deactivateLocation(location.id)}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {locations.length === 0 && <p>No locations created yet.</p>}
    </section>
  );
}

export default LocationManagement;