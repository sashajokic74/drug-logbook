import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("main app exposes the expected clinical task navigation", async () => {
  const app = await readSource("src/App.jsx");

  [
    "Main Logbook",
    "Stock Checks",
    "Corrections",
    "Pharmacy Requests",
    "Admin Setup",
    "Server connection lost",
  ].forEach((label) => {
    assert.match(app, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("drug register keeps patient list upload and administration controls", async () => {
  const register = await readSource("src/components/DrugRegister.jsx");
  const patientListPanel = await readSource("src/components/drugRegister/PatientListPanel.jsx");

  assert.match(register, /PatientListPanel/);
  assert.match(register, /Save Patient Entry/);
  assert.match(register, /Verify Administered By/);
  assert.match(register, /Verify Second Checker/);

  [
    "Download Sample List",
    ".xlsx,.xls,.csv,.tsv",
    "Archive Today",
    "Add Patient To This Area",
  ].forEach((label) => {
    assert.match(patientListPanel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("patient list import supports Excel, CSV and hospital-style headers", async () => {
  const importer = await readSource("src/components/drugRegister/patientListImport.js");

  [
    "read-excel-file/browser",
    "parsePatientDelimitedText",
    "hospitalnumber",
    "hospno",
    "casenumber",
    "operationdate",
    "plannedprocedure",
  ].forEach((text) => {
    assert.match(importer, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("app includes installable PWA files for iPad home screen use", async () => {
  const html = await readSource("index.html");
  const serviceWorkerRegistration = await readSource("src/registerServiceWorker.js");
  const manifest = await readSource("public/manifest.webmanifest");
  const serviceWorker = await readSource("public/service-worker.js");

  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(serviceWorkerRegistration, /serviceWorker/);
  assert.match(serviceWorkerRegistration, /import\.meta\.env\.PROD/);
  assert.match(manifest, /Controlled Drug Logbook/);
  assert.match(manifest, /standalone/);
  assert.match(serviceWorker, /cd-logbook-shell/);
});

test("app stylesheet includes iPad and home-screen layout support", async () => {
  const css = await readSource("src/index.css");

  [
    "100dvh",
    "touch-action: manipulation",
    "display-mode: standalone",
    "safe-area-inset",
    "min-width: 768px",
    "max-width: 1180px",
  ].forEach((text) => {
    assert.match(css, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("app wrapper has configurable API and Capacitor iOS config", async () => {
  const apiConfig = await readSource("src/apiConfig.js");
  const capacitorConfig = await readSource("capacitor.config.json");
  const app = await readSource("src/App.jsx");
  const client = await readSource("src/components/client.js");

  assert.match(apiConfig, /VITE_API_URL/);
  assert.match(apiConfig, /localhost:8000/);
  assert.match(capacitorConfig, /com\.sashajokic\.druglogbook/);
  assert.match(capacitorConfig, /"webDir": "dist"/);
  assert.match(app, /from "\.\/apiConfig"/);
  assert.match(client, /from "\.\.\/apiConfig"/);
});
