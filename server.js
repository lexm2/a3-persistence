require("dotenv").config();

const express = require("express"),
  session = require("express-session"),
  { MongoStore } = require("connect-mongo"),
  bcrypt = require("bcryptjs"),
  path = require("path"),
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

const buildRow = function (body, owner) {
  const theory = String(body.theory || "").trim() || "untitled";
  const conspirators = Math.max(1, Math.round(Number(body.conspirators)) || 1);
  const yearsRunning = Math.max(0, Number(body.yearsRunning) || 0);

  return Object.assign(
    { userId: owner._id, username: owner.username, theory, conspirators, yearsRunning },
    deriveFields(conspirators, yearsRunning),
  );
};

const toClient = function (doc, viewerId) {
  const { _id, userId, ...rest } = doc;
  return { id: _id.toString(), mine: userId.equals(viewerId), ...rest };
};

const parseID = function (id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
};

const client = new MongoClient(process.env.MONGODB_URI);
let users = null,
  conspiracies = null;

const connect = async function () {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "a3");
  users = db.collection("users");
  conspiracies = db.collection("conspiracies");

  await users.createIndex({ username: 1 }, { unique: true });
  await conspiracies.createIndex({ userId: 1 });
};

// ---------- auth ----------

// look up the user if the name is unused create account.
// returns { user, created } or null when the password is wrong
const loginOrRegister = async function (username, password) {
  const existing = await users.findOne({ username });

  if (existing) {
    const ok = await bcrypt.compare(password, existing.passwordHash);
    return ok ? { user: existing, created: false } : null;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { insertedId } = await users.insertOne({ username, passwordHash, createdAt: new Date() });

  return { user: { _id: insertedId, username }, created: true };
};

// pages redirect to the login form
const requireLogin = function (request, response, next) {
  if (request.session.userId) return next();
  if (request.originalUrl.startsWith("/api/")) return response.status(401).json({ error: "not logged in" });
  response.redirect("/login.html");
};

// ---------- middleware ----------

// render sits behind a proxy, needed for secure cookies
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ client, dbName: process.env.MONGODB_DB || "a3" }),
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 7 * 24 * 60 * 60 * 1000 },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get(["/", "/index.html"], requireLogin, function (request, response) {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(express.static("public", { index: false }));
app.use("/css/pico", express.static(path.join(__dirname, "node_modules/@picocss/pico/css")));

// ---------- auth routes ----------

app.post("/login", async function (request, response) {
  const username = String(request.body.username || "").trim();
  const password = String(request.body.password || "");

  if (!username || !password) return response.redirect("/login.html?error=missing");

  const result = await loginOrRegister(username, password);
  if (!result) return response.redirect("/login.html?error=password");

  request.session.userId = result.user._id.toString();
  request.session.username = result.user.username;
  // new accounts get told about it on the main page
  response.redirect(result.created ? "/?created=1" : "/");
});

app.post("/logout", function (request, response) {
  request.session.destroy(() => response.redirect("/login.html"));
});

// ---------- data routes ----------

app.use("/api", requireLogin);

const viewer = (request) => ({
  _id: new ObjectId(request.session.userId),
  username: request.session.username,
});

const allRows = async function (request) {
  const docs = await conspiracies.find({}).sort({ _id: 1 }).toArray();
  return docs.map((doc) => toClient(doc, viewer(request)._id));
};

app.get("/api/me", function (request, response) {
  response.json({ username: request.session.username });
});

app.get("/api/data", async function (request, response) {
  response.json(await allRows(request));
});

app.post("/api/add", async function (request, response) {
  await conspiracies.insertOne(buildRow(request.body, viewer(request)));
  response.json(await allRows(request));
});

app.post("/api/edit", async function (request, response) {
  const _id = parseID(request.body.id);
  const owner = viewer(request);
  if (_id) await conspiracies.updateOne({ _id, userId: owner._id }, { $set: buildRow(request.body, owner) });
  response.json(await allRows(request));
});

app.post("/api/delete", async function (request, response) {
  const _id = parseID(request.body.id);
  if (_id) await conspiracies.deleteOne({ _id, userId: viewer(request)._id });
  response.json(await allRows(request));
});

connect()
  .then(() => app.listen(process.env.PORT || port))
  .catch((err) => {
    console.error("could not connect to mongodb:", err.message);
    process.exit(1);
  });
