import apiFetch from "./components/client";

export function getPharmacyRequests(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return apiFetch(`/pharmacy-requests${query ? `?${query}` : ""}`);
}

export function createPharmacyRequest(data) {
  return apiFetch("/pharmacy-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyRequisition(data) {
  return apiFetch("/pharmacy-requests/verify-requisition", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function approvePharmacyRequest(id) {
  return apiFetch(`/pharmacy-requests/${id}/approve`, {
    method: "PUT",
  });
}

export function rejectPharmacyRequest(id, reason) {
  return apiFetch(`/pharmacy-requests/${id}/reject`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

export function completeRequest(id) {
  return apiFetch(`/pharmacy-requests/${id}/complete`, {
    method: "PUT",
  });
}
