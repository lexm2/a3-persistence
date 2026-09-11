const http = require("http"),
  fs = require("fs"),
  // IMPORTANT: you must run `npm install` in the directory for this assignment
  // to install the mime library if you're testing this on your local machine.
  // On Render, make sure `npm install` is your build command.
  mime = require("mime"),
  dir = "public/",
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

const server = http.createServer(function (request, response) {
  if (request.method === "GET") {
    handleGet(request, response);
  } else if (request.method === "POST") {
    handlePost(request, response);
  }
});

const handleGet = function (request, response) {
  const filename = dir + request.url.slice(1);

  if (request.url === "/") {
    sendFile(response, "public/index.html");
  } else if (request.url === "/api/data") {
    sendJSON(response, appdata);
  } else {
    sendFile(response, filename);
  }
};

const handlePost = function (request, response) {
  let dataString = "";

  request.on("data", function (data) {
    dataString += data;
  });

  request.on("end", function () {
    const body = JSON.parse(dataString);

    if (request.url === "/api/add") {
      appdata.push(buildRow(nextID++, body));
    } else if (request.url === "/api/edit") {
      const index = findIndexByID(body.id);
      if (index !== -1) appdata[index] = buildRow(body.id, body);
    } else if (request.url === "/api/delete") {
      const index = findIndexByID(body.id);
      if (index !== -1) appdata.splice(index, 1);
    }

    sendJSON(response, appdata);
  });
};

const sendJSON = function (response, data) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
};

const sendFile = function (response, filename) {
  const type = mime.getType(filename);
  // if the error = null, then we've loaded the file successfully
  fs.readFile(filename, function (err, content) {
    if (err === null) {
      // status code: https://httpstatuses.com
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
    } else {
      // file not found, error code 404
      response.writeHead(404);
      response.end("404 Error: File Not Found");
    }
  });
};

server.listen(process.env.PORT || port);
