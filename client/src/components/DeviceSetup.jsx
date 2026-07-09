import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

function DeviceSetup({
  heading = "Device Setup",
  intro = "",
  canManageSetup = false,
  onCancel,
  onDeviceSaved,
}) {
  const [hospitals, setHospitals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [message, setMessage] = useState("");

  const [newHospitalName, setNewHospitalName] = useState("");
  const [newLocation, setNewLocation] = useState({
    name: "",
    type: "Theatre",
  });

  const [form, setForm] = useState({
    deviceName: "",
    deviceCode: "",
    hospitalId: "",
    hospitalName: "",
    locationId: "",
    locationName: "",
    deviceType: "iPad",
  });

  function getAuthHeaders() {
    const token = localStorage.getItem("token");

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  }

  useEffect(() => {
    loadHospitals();
  }, []);

  async function loadHospitals() {
    try {
      const response = await fetch(`${API_URL}/device-setup/hospitals`);
      const data = await response.json();
      setHospitals(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load hospitals");
    }
  }

  async function loadLocations(hospitalId) {
    try {
      const response = await fetch(
        `${API_URL}/device-setup/locations?hospitalId=${hospitalId}`
      );
      const data = await response.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load locations");
    }
  }

  async function loadDevices(hospitalId, locationId) {
    try {
      const response = await fetch(
        `${API_URL}/device-setup/devices?hospitalId=${hospitalId}&locationId=${locationId}`
      );
      const data = await response.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Could not load devices");
    }
  }

  function selectHospital(event) {
    const hospitalId = event.target.value;
    const hospital = hospitals.find(
      (item) => String(item.id) === String(hospitalId)
    );

    setMessage("");
    localStorage.removeItem("device");
    setLocations([]);
    setDevices([]);
    setForm({
      ...form,
      hospitalId,
      hospitalName: hospital ? hospital.name : "",
      locationId: "",
      locationName: "",
      deviceName: "",
      deviceCode: "",
    });

    if (hospitalId) loadLocations(hospitalId);
  }

  function selectLocation(event) {
    const locationId = event.target.value;
    const location = locations.find(
      (item) => String(item.id) === String(locationId)
    );
    const hospitalPart = form.hospitalId || "H";

    const nextForm = {
      ...form,
      locationId,
      locationName: location ? location.name : "",
      deviceName: location ? `${location.name} iPad` : "",
      deviceCode: location
        ? makeDeviceCode(`${hospitalPart}-${locationId}-${location.name}`, "iPad")
        : "",
      deviceType: "iPad",
    };

    setMessage("");
    localStorage.removeItem("device");
    setDevices([]);
    setForm(nextForm);

    if (form.hospitalId && locationId) {
      loadDevices(form.hospitalId, locationId);
    }
  }

  function updateForm(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function addHospital(event) {
    event.preventDefault();
    setMessage("");

    const name = newHospitalName.trim();

    if (!name) {
      setMessage("Enter hospital name");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/device-setup/hospitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name }),
      });
      const hospital = await response.json();

      if (!response.ok) {
        setMessage(hospital.message || "Could not add hospital");
        return;
      }

      setNewHospitalName("");
      await loadHospitals();
      setForm({
        ...form,
        hospitalId: String(hospital.id),
        hospitalName: hospital.name,
        locationId: "",
        locationName: "",
      });
      await loadLocations(hospital.id);
      setMessage("Hospital added");
    } catch {
      setMessage("Server not running");
    }
  }

  async function addLocation(event) {
    event.preventDefault();
    setMessage("");

    if (!form.hospitalId) {
      setMessage("Select hospital first");
      return;
    }

    const names = newLocation.name
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setMessage("Enter location name");
      return;
    }

    try {
      let lastLocation = null;

      for (const name of names) {
        const response = await fetch(`${API_URL}/device-setup/locations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            hospitalId: Number(form.hospitalId),
            name,
            type: newLocation.type,
          }),
        });
        const location = await response.json();

        if (!response.ok) {
          setMessage(location.message || `Could not add ${name}`);
          return;
        }

        lastLocation = location;
      }

      setNewLocation({ name: "", type: "Theatre" });
      await loadLocations(form.hospitalId);

      if (lastLocation) {
        setForm({
          ...form,
          locationId: String(lastLocation.id),
          locationName: lastLocation.name,
          deviceName: `${lastLocation.name} iPad`,
          deviceCode: makeDeviceCode(
            `${form.hospitalId}-${lastLocation.id}-${lastLocation.name}`,
            "iPad"
          ),
          deviceType: "iPad",
        });
        await loadDevices(form.hospitalId, lastLocation.id);
      }

      setMessage("Location added");
    } catch {
      setMessage("Server not running");
    }
  }

  function makeDeviceCode(locationName, deviceType) {
    return `${locationName}-${deviceType}`
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase();
  }

  function useDevice(device) {
    const deviceData = {
      id: device.id,
      deviceName: device.deviceName,
      deviceCode: device.deviceCode,
      hospitalId: String(device.hospitalId),
      hospitalName: device.hospitalName,
      locationId: String(device.locationId),
      locationName: device.locationName,
      deviceType: device.deviceType || "iPad",
    };

    localStorage.setItem("device", JSON.stringify(deviceData));

    if (onDeviceSaved) {
      onDeviceSaved(deviceData);
    }
  }

  async function saveDevice(event) {
    event.preventDefault();
    setMessage("");

    if (!form.hospitalId || !form.locationId) {
      setMessage("Select hospital and location");
      return;
    }

    const deviceData = {
      ...form,
      deviceName: form.deviceName || `${form.locationName} iPad`,
      deviceCode:
        form.deviceCode ||
        makeDeviceCode(
          `${form.hospitalId}-${form.locationId}-${form.locationName}`,
          form.deviceType
        ),
    };

    try {
      const response = await fetch(`${API_URL}/device-setup/devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(deviceData),
      });
      const device = await response.json();

      if (!response.ok) {
        setMessage(device.message || "Could not save device");
        return;
      }

      useDevice(device);
    } catch {
      setMessage("Server not running");
    }
  }

  return (
    <main
      style={{
        maxWidth: "720px",
        margin: "40px auto",
        padding: "24px",
        background: "#ffffff",
        border: "1px solid #d8e0ea",
        borderRadius: "8px",
      }}
    >
      <h1 style={{ textAlign: "left", marginTop: 0 }}>
        {heading}
      </h1>

      {intro && (
        <p style={{ color: "#486174", fontWeight: 700 }}>
          {intro}
        </p>
      )}

      <label>
        Hospital
        <select value={form.hospitalId} onChange={selectHospital}>
          <option value="">Select hospital</option>
          {hospitals.map((hospital) => (
            <option key={hospital.id} value={hospital.id}>
              {hospital.name}
            </option>
          ))}
        </select>
      </label>

      {canManageSetup && (
        <form
          onSubmit={addHospital}
          style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}
        >
          <input
            placeholder="Add hospital"
            value={newHospitalName}
            onChange={(event) => setNewHospitalName(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      )}

      <label>
        Location
        <select
          value={form.locationId}
          onChange={selectLocation}
          disabled={!form.hospitalId}
        >
          <option value="">Select location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.type})
            </option>
          ))}
        </select>
      </label>

      {canManageSetup && (
        <form
          onSubmit={addLocation}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 150px auto",
            gap: "8px",
          }}
        >
          <input
            placeholder="Add location e.g. TH1, TH2, Recovery, ICU"
            value={newLocation.name}
            onChange={(event) =>
              setNewLocation({ ...newLocation, name: event.target.value })
            }
            disabled={!form.hospitalId}
          />
          <select
            value={newLocation.type}
            onChange={(event) =>
              setNewLocation({ ...newLocation, type: event.target.value })
            }
            disabled={!form.hospitalId}
          >
            <option>Theatre</option>
            <option>Recovery</option>
            <option>ICU</option>
            <option>Ward</option>
            <option>Clinic</option>
            <option>Pharmacy</option>
            <option>Other</option>
          </select>
          <button type="submit" disabled={!form.hospitalId}>
            Add
          </button>
        </form>
      )}

      {devices.length > 0 && (
        <>
          <h3>Saved iPad / Device</h3>
          {devices.map((device) => (
            <button
              key={device.id}
              type="button"
              onClick={() => useDevice(device)}
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: "8px",
                padding: "10px",
              }}
            >
              {device.deviceName} - {device.deviceCode}
            </button>
          ))}
        </>
      )}

      {canManageSetup ? (
        <form onSubmit={saveDevice}>
          <h3>iPad / Device</h3>

          <input
            name="deviceName"
            placeholder="Device name"
            value={form.deviceName}
            onChange={updateForm}
            disabled={!form.locationId}
          />

          <input
            name="deviceCode"
            placeholder="Device code"
            value={form.deviceCode}
            onChange={updateForm}
            disabled={!form.locationId}
          />

          <select
            name="deviceType"
            value={form.deviceType}
            onChange={updateForm}
            disabled={!form.locationId}
          >
            <option>iPad</option>
            <option>Computer</option>
            <option>Pharmacy Workstation</option>
            <option>Tablet</option>
          </select>

          <button
            type="submit"
            disabled={!form.hospitalId || !form.locationId}
            style={{ width: "100%", marginTop: "10px" }}
          >
            Save New Device
          </button>
        </form>
      ) : (
        form.hospitalId &&
        form.locationId &&
        devices.length === 0 && (
          <p style={{ fontWeight: "bold", color: "#7a4c00" }}>
            No saved device is available for this location. Ask admin to create it.
          </p>
        )
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{ width: "100%", marginTop: "8px" }}
        >
          Cancel
        </button>
      )}

      {message && (
        <p style={{ fontWeight: "bold", color: "red" }}>
          {message}
        </p>
      )}
    </main>
  );
}

export default DeviceSetup;
