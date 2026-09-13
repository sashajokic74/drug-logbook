function PharmacyStockPanel({
  balance,
  drug,
  openDrugRequests,
  pharmacyRequestForm,
  pharmacyRequestLogin,
  pharmacyRequestMessage,
  pharmacyRequestUser,
  showPharmacyRequest,
  showSupplyForm,
  supplyCheckerLogin,
  supplyCheckerUser,
  supplyForm,
  supplyMessage,
  supplyNewBalance,
  supplyReceivedLogin,
  supplyReceivedUser,
  verifiedRequisition,
  onSaveSupplyEntry,
  onSendPharmacyRequest,
  onTogglePharmacyRequest,
  onToggleSupplyForm,
  onUpdatePharmacyRequestForm,
  onUpdatePharmacyRequestLogin,
  onUpdateSupplyCheckerLogin,
  onUpdateSupplyForm,
  onUpdateSupplyReceivedLogin,
  onVerifyPharmacyRequestUser,
  onVerifySupplyChecker,
  onVerifySupplyReceivedBy,
  onVerifySupplyRequisition,
}) {
  return (
    <details className="pharmacy-stock-disclosure">
      <summary>
        <span>
          <strong>Pharmacy stock and requests</strong>
          <small>
            {openDrugRequests.length > 0
              ? `${openDrugRequests.length} pending/approved request${openDrugRequests.length === 1 ? "" : "s"} for ${drug.name}`
              : `Request or receive ${drug.name} stock`}
          </small>
        </span>
      </summary>

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

      <button type="button" onClick={onTogglePharmacyRequest}>
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
            onChange={onUpdatePharmacyRequestForm}
          />

          <select
            name="reason"
            value={pharmacyRequestForm.reason}
            onChange={onUpdatePharmacyRequestForm}
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
            onChange={onUpdatePharmacyRequestLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Authorised staff password"
            value={pharmacyRequestLogin.password}
            onChange={onUpdatePharmacyRequestLogin}
          />

          <button type="button" onClick={onVerifyPharmacyRequestUser}>
            Verify Authorised Staff
          </button>

          {pharmacyRequestUser && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              ✓ {pharmacyRequestUser.fullName || pharmacyRequestUser.username} verified
            </p>
          )}

          <button type="button" onClick={onSendPharmacyRequest}>
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

      <button type="button" onClick={onToggleSupplyForm}>
        {showSupplyForm ? "Hide Pharmacy Stock Supply" : "Receive Approved Pharmacy Stock"}
      </button>

      {showSupplyForm && (
        <>
          <h3>Pharmacy Stock Supply</h3>

          <input value={`Current balance: ${balance} ampoules`} disabled />

          <input
            type="number"
            name="ampoulesReceived"
            placeholder="Ampoules received from pharmacy"
            value={supplyForm.ampoulesReceived}
            onChange={onUpdateSupplyForm}
          />

          <input value={`Balance after supply: ${supplyNewBalance()} ampoules`} disabled />

          <input
            name="requisitionNumber"
            placeholder="Approved requisition number"
            value={supplyForm.requisitionNumber}
            onChange={onUpdateSupplyForm}
          />

          <button type="button" onClick={onVerifySupplyRequisition}>
            Verify Approved Requisition
          </button>

          {verifiedRequisition && (
            <p style={{ color: "green", fontWeight: "bold" }}>
              Requisition approved and matched: {verifiedRequisition.requisitionNumber}
            </p>
          )}

          <h4>Received By Verification</h4>

          <input
            name="username"
            placeholder="Receiving staff username"
            value={supplyReceivedLogin.username}
            onChange={onUpdateSupplyReceivedLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Receiving staff password"
            value={supplyReceivedLogin.password}
            onChange={onUpdateSupplyReceivedLogin}
          />

          <button type="button" onClick={onVerifySupplyReceivedBy}>
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
            onChange={onUpdateSupplyCheckerLogin}
          />

          <input
            type="password"
            name="password"
            placeholder="Checking staff password"
            value={supplyCheckerLogin.password}
            onChange={onUpdateSupplyCheckerLogin}
          />

          <button type="button" onClick={onVerifySupplyChecker}>
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

          <button type="button" onClick={onSaveSupplyEntry}>
            ➕ Add Pharmacy Supply
          </button>

          <hr />
        </>
      )}
    </details>
  );
}

export default PharmacyStockPanel;
