import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomInt, randomUUID, scryptSync } from "node:crypto";
import { request as httpsRequest } from "node:https";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const dataFile = process.env.DATA_FILE || join(root, "data", "store.json");
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const adminToken = process.env.ADMIN_TOKEN || "";
const visitWebhookUrl = process.env.VISIT_WEBHOOK_URL || "";
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || "";
const twilioToNumber = process.env.TWILIO_TO_NUMBER || "+255741998751";
const otpSecret = process.env.OTP_SECRET || randomBytes(32).toString("hex");
const seedListings = [
  { id: "maize-iringa", crop: "Maize", localName: "Mahindi", role: "farmer", location: "Iringa", distanceKm: 24, quantity: "2.4 tonnes", priceTshPerKg: 1150, status: "Ready now", description: "Dry grain, bagged and sorted" },
  { id: "rice-morogoro", crop: "Rice", localName: "Mpunga", role: "agent", location: "Morogoro", distanceKm: 41, quantity: "680 bags", priceTshPerKg: 2400, status: "Route forming", description: "Clean, locally milled grain" },
  { id: "cashew-mtwara", crop: "Cashew", localName: "Korosho", role: "farmer", location: "Mtwara", distanceKm: 12, quantity: "420 kg", priceTshPerKg: 3800, status: "New listing", description: "Sun-dried, farm-gate harvest" },
  { id: "cassava-mtwara", crop: "Cassava", localName: "Muhogo", role: "farmer", location: "Mtwara", distanceKm: 18, quantity: "1.8 tonnes", priceTshPerKg: 850, status: "Ready now", description: "Fresh roots for local markets" },
  { id: "beans-kigoma", crop: "Beans", localName: "Maharage", role: "farmer", location: "Kigoma", distanceKm: 32, quantity: "640 kg", priceTshPerKg: 2100, status: "New listing", description: "Sorted red kidney beans" },
  { id: "banana-kagera", crop: "Banana", localName: "Ndizi", role: "agent", location: "Kagera", distanceKm: 27, quantity: "900 bunches", priceTshPerKg: 900, status: "Route forming", description: "Cooking bananas for collection" },
  { id: "potato-arusha", crop: "Potato", localName: "Viazi", role: "farmer", location: "Arusha", distanceKm: 16, quantity: "3 tonnes", priceTshPerKg: 1250, status: "Ready now", description: "Washed table potatoes" },
  { id: "sorghum-dodoma", crop: "Sorghum", localName: "Mtama", role: "farmer", location: "Dodoma", distanceKm: 20, quantity: "1.2 tonnes", priceTshPerKg: 1050, status: "New listing", description: "Dry grain for food markets" },
  { id: "millet-singida", crop: "Millet", localName: "Ulezi", role: "farmer", location: "Singida", distanceKm: 22, quantity: "760 kg", priceTshPerKg: 1400, status: "Ready now", description: "Clean finger millet" },
  { id: "tomato-morogoro", crop: "Tomato", localName: "Nyanya", role: "agent", location: "Morogoro", distanceKm: 14, quantity: "320 crates", priceTshPerKg: 1300, status: "Route forming", description: "Fresh field tomatoes" },
  { id: "onion-manyara", crop: "Onion", localName: "Vitunguu", role: "farmer", location: "Manyara", distanceKm: 29, quantity: "1.4 tonnes", priceTshPerKg: 1800, status: "New listing", description: "Cured red onions" },
  { id: "sweet-potato-mara", crop: "Sweet potato", localName: "Viazi vitamu", role: "farmer", location: "Mara", distanceKm: 25, quantity: "980 kg", priceTshPerKg: 900, status: "Ready now", description: "Fresh orange-fleshed roots" },
  { id: "groundnut-tabora", crop: "Groundnut", localName: "Karanga", role: "agent", location: "Tabora", distanceKm: 38, quantity: "520 kg", priceTshPerKg: 2200, status: "Route forming", description: "Shelled food-grade groundnuts" }
];

function normalizeContact(type, value) {
  const contact = value.trim();
  if (type === "phone") {
    const digits = contact.replace(/\D/g, "");
    if (digits.startsWith("0")) return `+255${digits.slice(1)}`;
    if (digits.startsWith("255")) return `+${digits}`;
    return contact.startsWith("+") ? `+${digits}` : digits;
  }
  return contact.toLowerCase();
}

function hashValue(value) {
  return createHash("sha256").update(`${otpSecret}:${value}`).digest("hex");
}

function sendTwilioMessage(recipient, message) {
  const target = new URL(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`);
  const body = new URLSearchParams({ To: recipient, From: twilioFromNumber, Body: message }).toString();
  return new Promise((resolve, reject) => {
    const request = httpsRequest(target, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (response) => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        let result;
        try { result = JSON.parse(raw); } catch { result = {}; }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve();
        else reject(new Error(result.message || `Twilio rejected the message (HTTP ${response.statusCode}).`));
      });
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function sendVerificationCode(contact, code) {
  await sendTwilioMessage(contact, `Your ShambaLink verification code is ${code}. It expires in 10 minutes.`);
}

async function loadStore() {
  try {
    const store = JSON.parse(await readFile(dataFile, "utf8"));
    const existingIds = new Set((store.listings || []).map((item) => item.id));
    store.listings = [...(store.listings || []), ...seedListings.filter((item) => !existingIds.has(item.id))];
    return store;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const store = { listings: seedListings, interests: [] };
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(store, null, 2));
    return store;
  }
}

async function saveStore(store) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2));
}

function notifyVisit(visit) {
  if (!visitWebhookUrl) return;
  const target = new URL(visitWebhookUrl);
  if (target.protocol !== "https:") throw new Error("VISIT_WEBHOOK_URL must use HTTPS");
  const payload = JSON.stringify({ event: "shambalink.visit", visit });
  const request = httpsRequest(target, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } });
  request.on("error", (error) => console.error("Visit notification failed:", error.message));
  request.write(payload);
  request.end();
}

function isAdmin(request) {
  return Boolean(adminToken && request.headers.authorization === `Bearer ${adminToken}`);
}

function notifyInterestBySms(interest) {
  if (!twilioAccountSid && !twilioAuthToken && !twilioFromNumber) return;
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error("SMS notification requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER");
  }

  const message = `New ShambaLink ${interest.role} joined: ${interest.name}, ${interest.location}. Contact: ${interest.contact}`;
  const request = sendTwilioMessage(twilioToNumber, message);
  request.catch((error) => console.error("SMS notification failed:", error.message));
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) throw Object.assign(new Error("Request body is too large"), { status: 413 });
  }
  try { return JSON.parse(raw || "{}"); } catch { throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 }); }
}

function validateInterest(body) {
  const role = ["farmer", "agent", "buyer"].includes(body.role) ? body.role : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!role || name.length < 2 || name.length > 120 || !contact || contact.length > 160 || !location || location.length > 120) {
    return { error: "Provide a valid role, name, contact, and location." };
  }
  return { value: { role, name, contact, location } };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, { ok: true, service: "shambalink-api" });
    if (request.method === "GET" && url.pathname === "/api/listings") {
      const store = await loadStore();
      const role = url.searchParams.get("role");
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const listings = store.listings.filter((item) => (!role || role === "all" || item.role === role) && (!search || `${item.crop} ${item.localName} ${item.location}`.toLowerCase().includes(search)));
      return send(response, 200, { listings });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/request-code") {
      const body = await readBody(request);
      const contactType = body.contactType === "phone" ? "phone" : body.contactType === "email" ? "email" : "";
      const contact = typeof body.contact === "string" ? normalizeContact(contactType, body.contact) : "";
      if (!contactType || contact.length < 5 || (contactType === "phone" && !/^\+?[1-9]\d{7,14}$/.test(contact)) || (contactType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))) {
        return send(response, 422, { error: "Enter a valid email address or international phone number." });
      }
      const store = await loadStore();
      if ((store.users || []).some((user) => user.contact === contact)) return send(response, 409, { error: "This contact is already registered." });
      if (contactType !== "phone") return send(response, 501, { error: "Email verification is not configured yet. Choose phone to receive an SMS code." });
      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) return send(response, 503, { error: "Phone verification is temporarily unavailable." });
      const code = String(randomInt(100000, 1000000));
      const challenge = { id: randomUUID(), contact, contactType, codeHash: hashValue(code), expiresAt: Date.now() + 600000, attempts: 0 };
      store.otpChallenges = [...(store.otpChallenges || []).filter((item) => item.expiresAt > Date.now() && item.contact !== contact), challenge];
      await saveStore(store);
      try {
        await sendVerificationCode(contact, code);
      } catch (error) {
        store.otpChallenges = store.otpChallenges.filter((item) => item.id !== challenge.id);
        await saveStore(store);
        console.error("Verification SMS failed:", error.message);
        return send(response, 502, { error: "Twilio could not send the verification code. Check the number and try again." });
      }
      return send(response, 201, { challengeId: challenge.id, message: "Verification code sent." });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/verify-code") {
      const body = await readBody(request);
      const store = await loadStore();
      const challenge = (store.otpChallenges || []).find((item) => item.id === body.challengeId);
      if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) return send(response, 422, { error: "This code has expired. Request a new code." });
      challenge.attempts += 1;
      if (hashValue(String(body.code || "")) !== challenge.codeHash) {
        await saveStore(store);
        return send(response, 422, { error: "That verification code is not correct." });
      }
      challenge.verified = true;
      challenge.verificationToken = randomUUID();
      await saveStore(store);
      return send(response, 200, { verificationToken: challenge.verificationToken });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readBody(request);
      const store = await loadStore();
      const challenge = (store.otpChallenges || []).find((item) => item.verificationToken === body.verificationToken && item.verified);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const role = ["farmer", "agent", "buyer"].includes(body.role) ? body.role : "";
      if (!challenge || !name || name.length > 120 || !role) return send(response, 422, { error: "Complete verification and provide a valid name and role." });
      if ((store.users || []).some((user) => user.contact === challenge.contact)) return send(response, 409, { error: "This contact is already registered." });
      const user = { id: randomUUID(), name, role, contact: challenge.contact, contactType: challenge.contactType, passwordHash: body.password ? scryptSync(String(body.password), otpSecret, 32).toString("hex") : null, verifiedAt: new Date().toISOString() };
      store.users = [...(store.users || []), user];
      store.otpChallenges = (store.otpChallenges || []).filter((item) => item.id !== challenge.id);
      await saveStore(store);
      try { notifyInterestBySms({ role, name, location: "Not provided", contact: challenge.contact }); } catch (error) { console.error(error); }
      return send(response, 201, { user: { id: user.id, name: user.name, role: user.role, contact: user.contact } });
    }
    if (request.method === "POST" && url.pathname === "/api/visits") {
      const body = await readBody(request);
      const visit = {
        id: randomUUID(),
        path: typeof body.path === "string" ? body.path.slice(0, 200) : "/",
        referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 300) : "",
        language: body.language === "sw" ? "sw" : "en",
        createdAt: new Date().toISOString()
      };
      const store = await loadStore();
      store.visits = [...(store.visits || []), visit].slice(-10_000);
      await saveStore(store);
      try { notifyVisit(visit); } catch (error) { console.error(error); }
      return send(response, 201, { visit: { id: visit.id, createdAt: visit.createdAt } });
    }
    if (request.method === "GET" && url.pathname === "/api/visits") {
      if (!isAdmin(request)) return send(response, 401, { error: "Admin authorization required." });
      const store = await loadStore();
      return send(response, 200, { visits: (store.visits || []).slice(-100).reverse() });
    }
    if (request.method === "POST" && url.pathname === "/api/questions") {
      const body = await readBody(request);
      const question = typeof body.question === "string" ? body.question.trim() : "";
      const language = body.language === "sw" ? "sw" : "en";
      if (question.length < 3 || question.length > 500) return send(response, 422, { error: "Question must be between 3 and 500 characters." });
      const store = await loadStore();
      const unanswered = { id: randomUUID(), question, language, createdAt: new Date().toISOString() };
      store.questions = [...(store.questions || []), unanswered];
      await saveStore(store);
      return send(response, 201, { question: { id: unanswered.id, createdAt: unanswered.createdAt } });
    }
    if (request.method === "POST" && url.pathname === "/api/interests") {
      const validation = validateInterest(await readBody(request));
      if (validation.error) return send(response, 422, { error: validation.error });
      const store = await loadStore();
      const contact = validation.value.contact.toLowerCase();
      if ((store.users || []).some((user) => user.contact.toLowerCase() === contact) || (store.interests || []).some((item) => item.contact.toLowerCase() === contact)) {
        return send(response, 409, { error: "This contact is already registered." });
      }
      const interest = { id: randomUUID(), ...validation.value, createdAt: new Date().toISOString() };
      store.interests.push(interest);
      await saveStore(store);
      try { notifyInterestBySms(interest); } catch (error) { console.error(error); }
      return send(response, 201, { interest: { id: interest.id, role: interest.role, createdAt: interest.createdAt } });
    }
    return send(response, 404, { error: "Route not found" });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.status ? error.message : "Internal server error" });
  }
});

server.listen(port, () => console.log(`ShambaLink API listening on http://localhost:${port}`));
