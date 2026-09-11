const express = require("express"),
  app = express(),
  port = 3000;

// Grimes probability
const LEAK_RATE = 4.09e-6;
const EXPOSURE_THRESHOLD = -Math.log(0.05);
const appdata = [];
let nextID = 1;

const deriveFields = function (conspirators, yearsRunning) {
  const leaksPerYear = conspirators * LEAK_RATE;
  const exposureOdds = 1 - Math.exp(-leaksPerYear * yearsRunning);
  const yearsUntilExposed = EXPOSURE_THRESHOLD / leaksPerYear;

  return {
    leaksPerYear,
    exposureOdds,
    yearsUntilExposed,
    verdict: verdictFor(exposureOdds),
  };
};

const verdictFor = function (odds) {
  if (odds < 0.05) return "AIRTIGHT";
  if (odds < 0.5) return "HOLDING";
  if (odds < 0.95) return "LEAKING";
  return "BUSTED";
};

const findIndexByID = function (id) {
  return appdata.findIndex((row) => row.id === Number(id));
};

const buildRow = function (id, body) {
  const theory = String(body.theory || "untitled").trim();
  const conspirators = Math.max(1, Math.round(Number(body.conspirators)) || 1);
  const yearsRunning = Math.max(0, Number(body.yearsRunning) || 0);

  return Object.assign(
    { id, theory, conspirators, yearsRunning },
    deriveFields(conspirators, yearsRunning),
  );
};

[
  { theory: "Moon landing was faked", conspirators: 411000, yearsRunning: 57 },
  { theory: "Birds are drones", conspirators: 12000, yearsRunning: 45 },
  { theory: "Roommate ate my leftovers", conspirators: 1, yearsRunning: 0.02 },
].forEach((seed) => appdata.push(buildRow(nextID++, seed)));

// serve everything in public/ (index.html at "/") and parse JSON bodies
app.use(express.static("public"));
app.use(express.json());

app.get("/api/data", function (request, response) {
  response.json(appdata);
});

app.post("/api/add", function (request, response) {
  appdata.push(buildRow(nextID++, request.body));
  response.json(appdata);
});

app.post("/api/edit", function (request, response) {
  const index = findIndexByID(request.body.id);
  if (index !== -1) appdata[index] = buildRow(request.body.id, request.body);
  response.json(appdata);
});

app.post("/api/delete", function (request, response) {
  const index = findIndexByID(request.body.id);
  if (index !== -1) appdata.splice(index, 1);
  response.json(appdata);
});

app.listen(process.env.PORT || port);
