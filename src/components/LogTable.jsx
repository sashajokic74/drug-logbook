import drugs from "../drug data/drugs";

function LogTable() {
  return (
    <div className="log-table-container">
      <h2>Controlled Drug Register</h2>

      <table className="log-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Drug</th>
            <th>Dose</th>
            <th>Balance</th>
            <th>Staff ID</th>
            <th>Checker</th>
            <th>Signature</th>
          </tr>
        </thead>

        <tbody>
          {drugs.map((drug, index) => (
            <tr key={index}>
              <td>22/05/2026</td>
              <td>Patient Name</td>
              <td>{drug.name}</td>
              <td>{drug.concentration}</td>
              <td>{drug.quantity}</td>
              <td>ODP001</td>
              <td>Nurse001</td>
              <td>Signed</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LogTable;