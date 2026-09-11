require("dotenv").config();

const express = require("express"),
  { MongoClient, ObjectId } = require("mongodb"),
  app = express(),
  port = 3000;

// Grimes probability
const LEAK_RATE = 4.09e-6;
const EXPOSURE_THRESHOLD = -Math.log(0.05);

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

const buildRow = function (body) {
  const theory = String(body.theory || "").trim() || "untitled";
  const conspirators = Math.max(1, Math.round(Number(body.conspirators)) || 1);
  const yearsRunning = Math.max(0, Number(body.yearsRunning) || 0);

  return Object.assign(
    { theory, conspirators, yearsRunning },
    deriveFields(conspirators, yearsRunning),
  );
};

const toClient = function (doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
};

const parseID = function (id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
};

const client = new MongoClient(process.env.MONGODB_URI);
let collection = null;

const connect = async function () {
  await client.connect();
  collection = client.db(process.env.MONGODB_DB || "a3").collection("conspiracies");

  // seed a fresh db
  if ((await collection.countDocuments()) === 0) {
    await collection.insertMany(
      [
        { theory: "Moon landing was faked", conspirators: 411000, yearsRunning: 57 },
        { theory: "Birds are drones", conspirators: 12000, yearsRunning: 45 },
        { theory: "Roommate ate my leftovers", conspirators: 1, yearsRunning: 0.02 },
      ].map(buildRow),
    );
  }
};

const allRows = async function () {
  const docs = await collection.find({}).toArray();
  return docs.map(toClient);
};

app.use(express.static("public"));
app.use(express.json());

// refuse API requests until the database is ready
app.use("/api", function (request, response, next) {
  if (collection === null) return response.status(503).json({ error: "database not connected" });
  next();
});

app.get("/api/data", async function (request, response) {
  response.json(await allRows());
});

app.post("/api/add", async function (request, response) {
  await collection.insertOne(buildRow(request.body));
  response.json(await allRows());
});

app.post("/api/edit", async function (request, response) {
  const _id = parseID(request.body.id);
  if (_id) await collection.updateOne({ _id }, { $set: buildRow(request.body) });
  response.json(await allRows());
});

app.post("/api/delete", async function (request, response) {
  const _id = parseID(request.body.id);
  if (_id) await collection.deleteOne({ _id });
  response.json(await allRows());
});

connect()
  .then(() => app.listen(process.env.PORT || port))
  .catch((err) => {
    console.error("could not connect to mongodb:", err.message);
    process.exit(1);
  });
