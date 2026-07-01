import apiFetch from "./client";

export function getPharmacyRequests() {
  return apiFetch("/pharmacy-requests");
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