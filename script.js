(() => {
  const configuredApi = window.SHAMBALINK_API_URL || localStorage.getItem("shambalink-api-url") || new URLSearchParams(window.location.search).get("api") || "";
  let apiBase = "";
  try {
    const apiUrl = new URL(configuredApi, window.location.origin);
    if (configuredApi && apiUrl.protocol === "https:") apiBase = apiUrl.origin.replace(/\/$/, "");
  } catch {
    apiBase = "";
  }
  if (apiBase && !sessionStorage.getItem("shambalink-visit-recorded")) {
    fetch(`${apiBase}/api/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer })
    }).then((response) => {
      if (response.ok) sessionStorage.setItem("shambalink-visit-recorded", "true");
    }).catch(() => {});
  }
  const themeNames = ["field", "night", "sunrise"];
  let currentTheme = localStorage.getItem("shambalink-theme") || "field";
  document.documentElement.dataset.theme = currentTheme === "field" ? "" : currentTheme;
  const themeToggle = document.querySelector("#theme-toggle");
  function updateThemeControl() {
    const nextTheme = themeNames[(themeNames.indexOf(currentTheme) + 1) % themeNames.length];
    const labels = currentLanguage === "sw" ? { field: "Mandhari", night: "Usiku", sunrise: "Machweo" } : { field: "Field", night: "Night", sunrise: "Sunrise" };
    themeToggle?.setAttribute("aria-label", `${currentLanguage === "sw" ? "Badilisha mandhari" : "Change theme"}: ${labels[nextTheme]}`);
    if (themeToggle) themeToggle.innerHTML = `◐ <span>${labels[currentTheme]}</span>`;
  }
  themeToggle?.addEventListener("click", () => {
    currentTheme = themeNames[(themeNames.indexOf(currentTheme) + 1) % themeNames.length];
    document.documentElement.dataset.theme = currentTheme === "field" ? "" : currentTheme;
    localStorage.setItem("shambalink-theme", currentTheme);
    updateThemeControl();
  });
  const today = new Date();
  const year = document.querySelector("#year");
  if (year) year.textContent = today.getFullYear();
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#site-nav");
  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });

  const registrationGate = document.querySelector("#registration-gate");
  const services = document.querySelector("[data-services]");
  const registrationForm = document.querySelector("#registration-form");
  const registrationKey = "shambalink-member-v2";
  function apiMessage(response, fallback) {
    return response.text().then((text) => {
      try { return { ok: response.ok, data: JSON.parse(text) }; } catch { return { ok: false, data: { error: fallback } }; }
    });
  }
  function normalizedPhone(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("0")) return `+255${digits.slice(1)}`;
    if (digits.startsWith("255")) return `+${digits}`;
    return value.trim().startsWith("+") ? `+${digits}` : digits;
  }
  document.querySelectorAll("input[name=contactType]").forEach((input) => input.addEventListener("change", () => {
    const contact = document.querySelector("#register-contact");
    const phone = input.value === "phone" && input.checked;
    contact.type = phone ? "tel" : "email";
    contact.autocomplete = phone ? "tel" : "email";
    contact.placeholder = phone ? "+255 741 998 751" : "name@example.com";
    document.querySelector('label[for="register-contact"]').textContent = phone ? "Phone number" : "Email address";
  }));
  function openServices() {
    if (registrationGate) registrationGate.hidden = true;
    if (services) services.hidden = false;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
  if (localStorage.getItem(registrationKey)) openServices();
  registrationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.querySelector("#register-name");
    const contact = document.querySelector("#register-contact");
    const password = document.querySelector("#register-password");
    const terms = document.querySelector("#register-terms");
    const status = document.querySelector("#registration-status");
    const contactType = registrationForm.querySelector("input[name=contactType]:checked").value;
    let valid = true;
    [[name, "register-name-error", name.value.trim().length < 2],
      [contact, "register-contact-error", contactType === "phone" ? !/^\+[1-9]\d{7,14}$/.test(normalizedPhone(contact.value)) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value.trim())],
      [password, "register-password-error", password.value.length < 8],
      [terms, "register-terms-error", !terms.checked]].forEach(([field, errorId, invalid]) => {
      const error = document.querySelector(`#${errorId}`);
      error.textContent = "";
      if (invalid) {
        error.textContent = currentLanguage === "sw" ? "Tafadhali jaza sehemu hii kwa usahihi." : "Please complete this field correctly.";
        valid = false;
      }
    });
    if (!valid) {
      status.textContent = currentLanguage === "sw" ? "Kagua taarifa zako kisha ujaribu tena." : "Check your details and try again.";
      status.classList.add("is-error");
      return;
    }
    try {
      const normalized = contactType === "phone" ? normalizedPhone(contact.value) : contact.value.trim().toLowerCase();
      const role = registrationForm.querySelector("input[name=role]:checked").value;
      const profile = { name: name.value.trim(), role, contact: normalized, contactType, registeredAt: new Date().toISOString() };
      if (apiBase) {
        const response = await fetch(`${apiBase}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profile, password: password.value })
        });
        const result = await apiMessage(response, "Registration is unavailable.");
        if (!result.ok) throw new Error(result.data.error || "Registration is unavailable.");
        profile.id = result.data.user.id;
        status.textContent = currentLanguage === "sw" ? "Umejiunga na ShambaLink." : "You have joined ShambaLink.";
      } else {
        status.textContent = currentLanguage === "sw"
          ? "Wasifu umehifadhiwa kwenye kifaa hiki; hifadhi ya seva itaunganishwa baadaye."
          : "Profile saved on this device. Server storage will be available when the API is connected.";
      }
      localStorage.setItem(registrationKey, JSON.stringify(profile));
      status.classList.remove("is-error");
      openServices();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });

  const search = document.querySelector("#produce-search");
  const filter = document.querySelector("#role-filter");
  const listings = [...document.querySelectorAll(".listing")];
  const empty = document.querySelector("#empty-listings");
  const cropDetail = document.querySelector("#crop-detail");
  let selectedCrop = null;
  const cropCatalog = [
    { crop: "Maize", localName: "Mahindi", location: "Iringa", quantity: "2.4 tonnes", priceTshPerKg: 1150, status: "Ready now", note: "Dry grain, bagged and sorted." },
    { crop: "Rice", localName: "Mpunga", location: "Morogoro", quantity: "680 bags", priceTshPerKg: 2400, status: "Route forming", note: "Clean, locally milled grain." },
    { crop: "Cassava", localName: "Muhogo", location: "Mtwara", quantity: "1.8 tonnes", priceTshPerKg: 850, status: "Ready now", note: "Fresh roots for local markets." },
    { crop: "Beans", localName: "Maharage", location: "Kigoma", quantity: "640 kg", priceTshPerKg: 2100, status: "New listing", note: "Sorted red kidney beans." },
    { crop: "Banana", localName: "Ndizi", location: "Kagera", quantity: "900 bunches", priceTshPerKg: 900, status: "Route forming", note: "Cooking bananas for collection." },
    { crop: "Potato", localName: "Viazi", location: "Arusha", quantity: "3 tonnes", priceTshPerKg: 1250, status: "Ready now", note: "Washed table potatoes." },
    { crop: "Sorghum", localName: "Mtama", location: "Dodoma", quantity: "1.2 tonnes", priceTshPerKg: 1050, status: "New listing", note: "Dry grain for food markets." },
    { crop: "Millet", localName: "Ulezi", location: "Singida", quantity: "760 kg", priceTshPerKg: 1400, status: "Ready now", note: "Clean finger millet." },
    { crop: "Tomato", localName: "Nyanya", location: "Morogoro", quantity: "320 crates", priceTshPerKg: 1300, status: "Route forming", note: "Fresh field tomatoes." },
    { crop: "Onion", localName: "Vitunguu", location: "Manyara", quantity: "1.4 tonnes", priceTshPerKg: 1800, status: "New listing", note: "Cured red onions." },
    { crop: "Sweet potato", localName: "Viazi vitamu", location: "Mara", quantity: "980 kg", priceTshPerKg: 900, status: "Ready now", note: "Fresh orange-fleshed roots." },
    { crop: "Groundnut", localName: "Karanga", location: "Tabora", quantity: "520 kg", priceTshPerKg: 2200, status: "Route forming", note: "Shelled food-grade groundnuts." },
    { crop: "Sesame", localName: "Ufuta", location: "Lindi", quantity: "430 kg", priceTshPerKg: 2600, status: "New listing", note: "Clean sesame for food markets." },
    { crop: "Sunflower", localName: "Alizeti", location: "Singida", quantity: "1 tonne", priceTshPerKg: 1250, status: "Ready now", note: "Seed for oil and food processing." },
    { crop: "Wheat", localName: "Ngano", location: "Arusha", quantity: "2 tonnes", priceTshPerKg: 1500, status: "Route forming", note: "Clean grain for milling." }
  ];
  function showCropDetail(term) {
    const normalized = term.toLowerCase().trim();
    const crop = cropCatalog.find((item) => `${item.crop} ${item.localName}`.toLowerCase().includes(normalized) || normalized.includes(item.crop.toLowerCase()) || normalized.includes(item.localName.toLowerCase()));
    if (!crop || normalized.length < 2) { cropDetail.hidden = true; return; }
    selectedCrop = crop;
    const render = (item) => {
      document.querySelector(".crop-detail-kicker").textContent = currentLanguage === "sw" ? "Zao lililochaguliwa" : "Selected crop";
      document.querySelector(".crop-detail-grid div:nth-child(1) span").textContent = currentLanguage === "sw" ? "Soko" : "Market";
      document.querySelector(".crop-detail-grid div:nth-child(2) span").textContent = currentLanguage === "sw" ? "Inapatikana" : "Available";
      document.querySelector(".crop-detail-grid div:nth-child(3) span").textContent = currentLanguage === "sw" ? "Bei" : "Price";
      document.querySelector("#crop-detail-title").textContent = `${item.crop} / ${item.localName}`;
      document.querySelector("#crop-detail-status").textContent = item.status;
      document.querySelector("#crop-detail-market").textContent = `${item.location}, Tanzania`;
      document.querySelector("#crop-detail-quantity").textContent = item.quantity;
      document.querySelector("#crop-detail-price").textContent = `TSh ${Number(item.priceTshPerKg).toLocaleString()} / kg`;
      const note = item.note || item.description || "";
      document.querySelector("#crop-detail-note").textContent = currentLanguage === "sw" ? `${note} Thibitisha bei ya mwisho kabla ya biashara.` : `${note} Verify the final negotiated price before trading.`;
      cropDetail.hidden = false;
    };
    if (apiBase) {
      fetch(`${apiBase}/api/listings?search=${encodeURIComponent(crop.crop)}`).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => render(data.listings[0] || crop)).catch(() => render(crop));
    } else render(crop);
  }
  function filterListings() {
    const term = search.value.trim().toLowerCase();
    showCropDetail(term);
    const role = filter.value;
    let visible = 0;
    listings.forEach((listing) => {
      const matches = (!term || listing.dataset.search.includes(term)) && (role === "all" || listing.dataset.role === role);
      listing.hidden = !matches;
      if (matches) visible++;
    });
    empty.hidden = visible > 0;
  }
  search?.addEventListener("input", filterListings);
  filter?.addEventListener("change", filterListings);
  document.querySelectorAll("[data-crop-search]").forEach((button) => {
    button.addEventListener("click", () => {
      search.value = button.dataset.cropSearch.split(" ")[0];
      filterListings();
      search.focus();
    });
  });
  document.querySelectorAll("[data-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      button.textContent = currentLanguage === "sw" ? "Nia imehifadhiwa ✓" : "Interest noted ✓";
      button.setAttribute("aria-pressed", "true");
    });

  });

  let currentLanguage = "en";
  const swahili = {
    "Skip to content": "Ruka hadi kwenye maudhui", "Toggle navigation": "Fungua menyu", "Menu": "Menyu",
    "How it works": "Jinsi inavyofanya kazi", "Browse produce": "Tazama mazao", "Join the network": "Jiunge na mtandao", "Get started": "Anza sasa",
    "A clearer route from field to table": "Njia rahisi kutoka shambani hadi mezani", "Good food should": "Chakula bora kinapaswa", "move fairly.": "kusafirishwa kwa haki.",
    "ShambaLink brings Tanzanian farmers, trusted agents, and serious buyers into one simple market—so every harvest has a better chance to reach the people who need it.": "ShambaLink huwaunganisha wakulima wa Tanzania, mawakala wanaoaminika na wanunuzi katika soko moja—ili kila mavuno yawafikie wanaoyahitaji.",
    "See what’s available": "Tazama yanayopatikana", "Learn the route": "Jifunze njia", "Market snapshot": "Muhtasari wa soko", "LIVE BOARD": "UBAO WA LIVE",
    "Fresh harvests, clear quantities, fewer unanswered calls.": "Mavuno mapya, kiasi kinachoeleweka, na simu chache zisizojibiwa.", "Browse the market board": "Tazama ubao wa soko",
    "Live board": "Ubao wa moja kwa moja", "12 harvests moving today": "Mavuno 12 yanasafirishwa leo", "Explore the network": "Chunguza mtandao",
    "One network, three roles": "Mtandao mmoja, nafasi tatu", "Find your place": "Pata nafasi yako", "in the harvest.": "katika mavuno.",
    "ShambaLink keeps everyone close to the information they need—without making anyone speak a different language.": "ShambaLink huwapa wote taarifa wanazohitaji—bila kumlazimisha mtu kutumia lugha tofauti.",
    "Farmers": "Wakulima", "Agents": "Mawakala", "Buyers": "Wanunuzi", "Show what is ready, set your terms, and reach buyers beyond the gate.": "Onyesha kilicho tayari, weka masharti yako, na wafikie wanunuzi zaidi ya shamba.",
    "List a harvest": "Tangaza mavuno", "Coordinate a route": "Ratibu njia", "Coordinate collection, connect the right people, and keep every promise visible.": "Ratibu ukusanyaji, waunganishe watu sahihi, na weka kila ahadi wazi.",
    "Find produce": "Tafuta mazao", "Find dependable supply, compare details, and buy with confidence.": "Pata mazao ya kuaminika, linganisha maelezo, na nunua kwa ujasiri.",
    "Live market board": "Ubao wa soko wa moja kwa moja", "What’s moving": "Kinachosafirishwa", "this week.": "wiki hii.", "All listings": "Matangazo yote", "Farmer listings": "Matangazo ya wakulima", "Agent coordinated": "Yaliyoratibiwa na wakala",
    "Tanzania market references · verify the final negotiated price with your agent before trading.": "Marejeo ya soko la Tanzania · thibitisha bei ya mwisho na wakala wako kabla ya biashara.", "Price pulse · TSh per kg": "Mwelekeo wa bei · TSh kwa kilo",
    "Stable demand across the board.": "Mahitaji ni thabiti kwa mazao yote.", "Reference movement over the last four market checks.": "Mabadiliko ya bei katika vipimo vinne vya mwisho vya soko.",
    "Ready now": "Tayari sasa", "Route forming": "Njia inaundwa", "New listing": "Tangazo jipya", "Dry grain, bagged and sorted": "Nafaka kavu, imefungashwa na kuchambuliwa",
    "Clean, locally milled grain": "Nafaka safi iliyosagwa hapa nchini", "Sun-dried, farm-gate harvest": "Mavuno yaliyokaushwa juani shambani", "Indicative": "Bei ya rejea", "Pickup Friday": "Kuchukuliwa Ijumaa", "Available today": "Inapatikana leo",
    "Mon": "Jumatatu", "Wed": "Jumatano", "Fri": "Ijumaa",
    "Request details": "Omba maelezo", "No listings match that search yet. Try another crop or clear the filter.": "Hakuna tangazo linalolingana. Tafuta zao jingine au ondoa kichujio.",
    "The route": "Njia", "Less guessing.": "Makisio kidogo.", "More moving.": "Usafirishaji zaidi.", "Every handoff gets a little clearer, from the first listing to the final delivery.": "Kila hatua huwa wazi zaidi, kuanzia tangazo la kwanza hadi uwasilishaji wa mwisho.",
    "Post what’s ready": "Tangaza kilicho tayari", "Share crop, quantity, timing, and pickup details in a few minutes.": "Shiriki zao, kiasi, muda na maelezo ya kuchukua kwa dakika chache.",
    "Match the right route": "Pata njia sahihi", "Agents can help coordinate collection while buyers compare real options.": "Mawakala wanaweza kuratibu ukusanyaji huku wanunuzi wakilinganisha chaguo halisi.",
    "Move with confidence": "Songa kwa ujasiri", "Keep the conversation, expectations, and next step in one visible place.": "Weka mawasiliano, matarajio na hatua inayofuata mahali pamoja panapoonekana.",
    "Start with your role": "Anza na nafasi yako", "Put your work": "Weka kazi yako", "on the map.": "kwenye ramani.",
    "Join the ShambaLink network and connect with farmers, agents, and buyers across Tanzania.": "Jiunge na mtandao wa ShambaLink na uunganishwe na wakulima, mawakala na wanunuzi Tanzania nzima.",
    "I’m a farmer": "Mimi ni mkulima", "I’m an agent": "Mimi ni wakala", "I’m a buyer": "Mimi ni mnunuzi", "Choose your role": "Chagua nafasi yako",
    "Your name or business": "Jina lako au biashara", "Phone or email": "Simu au barua pepe", "Where are you based?": "Unaishi wapi?", "Town, region or district": "Mji, mkoa au wilaya",
    "Join ShambaLink": "Jiunge na ShambaLink", "Your details are sent securely to the ShambaLink service.": "Taarifa zako zitatumwa kwa usalama kwenye huduma ya ShambaLink.",
    "Ask Shamba AI": "Uliza Shamba AI", "Shamba AI": "Shamba AI", "Ask about crops, roles, or how to use the market board.": "Uliza kuhusu mazao, nafasi au jinsi ya kutumia ubao wa soko.",
    "What grows in Tanzania?": "Nini hulimwa Tanzania?", "How do I list maize?": "Nitawekaje mahindi?", "Help me buy rice": "Nisaidie kununua mpunga", "Ask a question…": "Uliza swali…",
    "Better routes for better harvests.": "Njia bora kwa mavuno bora.", "Food crops:": "Mazao ya chakula:", "Cassava / Muhogo": "Muhogo", "Beans / Maharage": "Maharage", "Banana / Ndizi": "Ndizi", "Potato / Viazi": "Viazi", "Sorghum / Mtama": "Mtama", "Millet / Ulezi": "Ulezi", "Tomato / Nyanya": "Nyanya", "Onion / Vitunguu": "Vitunguu", "Sweet potato / Viazi vitamu": "Viazi vitamu", "Groundnut / Karanga": "Karanga", "Sesame / Ufuta": "Ufuta", "Sunflower / Alizeti": "Alizeti", "Wheat / Ngano": "Ngano",     "Selected crop": "Zao lililochaguliwa", "Market": "Soko", "Available": "Inapatikana", "Price": "Bei",
    "Welcome to ShambaLink": "Karibu ShambaLink", "Your harvest network": "Mtandao wako wa mavuno", "starts here.": "unaanza hapa.",
    "Create a profile to browse services, prices, and routes across Tanzania. Phone verification is paused for now.": "Unda wasifu ili kuona huduma, bei na njia za biashara Tanzania. Uthibitishaji wa simu umesitishwa kwa sasa.",
    "Full name or business": "Jina kamili au biashara", "Email address": "Barua pepe", "Phone number": "Nambari ya simu", "Create password": "Unda nenosiri",
    "Choose contact type": "Chagua aina ya mawasiliano", "Phone": "Simu",
    "I am joining as": "Ninajiunga kama", "Farmer": "Mkulima", "Agent": "Wakala", "Buyer": "Mnunuzi",
    "I agree to the ShambaLink terms and privacy notice.": "Ninakubali masharti na taarifa ya faragha ya ShambaLink.", "Join ShambaLink": "Jiunge na ShambaLink",
    "Please complete this field correctly.": "Tafadhali jaza sehemu hii kwa usahihi.", "Check your details and try again.": "Kagua taarifa zako kisha ujaribu tena.",
    "Profile saved on this device. Server storage will be available when the API is connected.": "Wasifu umehifadhiwa kwenye kifaa hiki; hifadhi ya seva itapatikana API ikiunganishwa.",
    "You have joined ShambaLink.": "Umejiunga na ShambaLink."
  };
  const translatedAttributes = {
    "aria-label": { "Primary navigation": "Menyu kuu", "Language selector": "Kichagua lugha", "Market snapshot": "Muhtasari wa soko", "Open live market board": "Fungua ubao wa soko", "Indicative crop price trend": "Mwelekeo wa bei za mazao", "Choose your role": "Chagua nafasi yako", "ShambaLink AI assistant": "Msaidizi wa ShambaLink AI", "Close assistant": "Funga msaidizi", "Send question": "Tuma swali" },
    "placeholder": { "Search produce…": "Tafuta mazao…", "Search any Tanzania food crop…": "Tafuta zao lolote la chakula Tanzania…", "Town, region or district": "Mji, mkoa au wilaya", "Ask a question…": "Uliza swali…" },
    "alt": { "Farmer tending crops in a green field": "Mkulima akitunza mazao katika shamba la kijani", "Market partners coordinating a route": "Washirika wa soko wakiratibu njia", "Buyer checking produce supply": "Mnunuzi akikagua upatikanaji wa mazao", "Maize cobs in a field": "Magunzi ya mahindi shambani", "Rice plants and grains spilling from a sack": "Mimea ya mpunga na punje zikimwagika kutoka kwenye gunia", "Cashew nuts in a bowl": "Korosho kwenye bakuli" }
  };
  const originalText = new WeakMap();
  function translatePage(language) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!node.nodeValue.trim() || node.parentElement.closest("script,style")) return;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const original = originalText.get(node);
      const key = original.trim();
      node.nodeValue = language === "sw" && swahili[key] ? original.replace(key, swahili[key]) : original;
    });
    document.querySelectorAll("[aria-label], [placeholder], img[alt]").forEach((element) => {
      ["aria-label", "placeholder", "alt"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        const translated = translatedAttributes[attribute]?.[value];
        if (translated) {
          if (!element.dataset[`en${attribute}`]) element.dataset[`en${attribute}`] = value;
          element.setAttribute(attribute, language === "sw" ? translated : element.dataset[`en${attribute}`]);
        }
      });
    });
    document.title = language === "sw" ? "ShambaLink — Kutoka shambani hadi soko la haki" : "ShambaLink — From shamba to fair market";
    currentLanguage = language;
    updateThemeControl();
    renderAssistantSuggestions();
    if (selectedCrop) showCropDetail(selectedCrop.crop);
  }
  document.querySelectorAll(".language-button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".language-button").forEach((item) => item.classList.toggle("is-active", item === button));
    document.documentElement.lang = button.dataset.language === "sw" ? "sw" : "en";
    translatePage(button.dataset.language);
  }));

  let selectedRole = "farmer";
  document.querySelectorAll(".role-choice").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      document.querySelectorAll(".role-choice").forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
    });
  });
  document.querySelectorAll("[data-role-link]").forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.querySelector(`.role-choice[data-role="${link.dataset.roleLink}"]`);
      target?.click();
    });
  });

  const joinForm = document.querySelector("#join-form");
  joinForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    let valid = true;
    ["name", "contact", "location"].forEach((field) => {
      const input = document.querySelector(`#join-${field}`);
      const error = document.querySelector(`#${field}-error`);
      error.textContent = "";
      if (!input.value.trim()) { error.textContent = currentLanguage === "sw" ? "Sehemu hii inahitajika." : "This field is required."; valid = false; }
    });
    if (!valid) { joinForm.querySelector("input:invalid, input:not(:placeholder-shown)")?.focus(); return; }
    const labels = { farmer: "farmer", agent: "agent", buyer: "buyer" };
    const success = document.querySelector("#join-success");
    const payload = { role: selectedRole, name: document.querySelector("#join-name").value.trim(), contact: document.querySelector("#join-contact").value.trim(), location: document.querySelector("#join-location").value.trim() };
    const saveInterest = apiBase
      ? fetch(`${apiBase}/api/interests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((response) => {
        if (!response.ok) throw new Error("The service could not save your interest.");
        return response.json();
      })
      : Promise.reject(new Error("ShambaLink service is not configured."));
    saveInterest.then(() => {
      success.hidden = false;
      const roleName = currentLanguage === "sw" ? ({ farmer: "mkulima", agent: "wakala", buyer: "mnunuzi" }[selectedRole]) : labels[selectedRole];
      success.textContent = currentLanguage === "sw" ? `Asante—nia yako kama ${roleName} sasa iko kwenye mtandao wa ShambaLink.` : `Thanks—your ${roleName} interest is now in the ShambaLink network.`;
      joinForm.querySelector("button[type=submit]").disabled = true;
    }).catch(() => {
      success.hidden = false;
      success.textContent = currentLanguage === "sw" ? "ShambaLink haipatikani kwa muda. Tafadhali jaribu tena hivi karibuni." : "ShambaLink is temporarily unavailable. Please try again shortly.";
    });
  });

  const assistantToggle = document.querySelector("#assistant-toggle");
  const assistantPanel = document.querySelector("#assistant-panel");
  const assistantClose = document.querySelector("#assistant-close");
  const assistantInput = document.querySelector("#assistant-input");
  const assistantResponse = document.querySelector("#assistant-response");
  const assistantSuggestions = document.querySelector(".assistant-suggestions");
  const assistantQuestionBank = {
    en: ["What grows in Tanzania?", "How do I list maize?", "Help me buy rice", "How can I find a buyer?", "What does an agent do?", "How should I store maize?", "How do I prepare cashew for sale?", "Which region grows the most rice?"],
    sw: ["Nini hulimwa Tanzania?", "Nitawekaje mahindi?", "Nisaidie kununua mpunga", "Nitampataje mnunuzi?", "Wakala anafanya nini?", "Nahifadhije mahindi?", "Ninaandaaje korosho kwa kuuza?", "Ni mkoa gani hulima mpunga zaidi?"]
  };
  function renderAssistantSuggestions() {
    if (!assistantSuggestions) return;
    assistantSuggestions.innerHTML = assistantQuestionBank[currentLanguage].map((question) => `<button type="button">${question}</button>`).join("");
    assistantSuggestions.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      assistantInput.value = button.textContent;
      const answer = answerAssistant(button.textContent);
      if (answer) assistantResponse.textContent = answer;
    }));
  }
  function submitUnansweredQuestion(question) {
    if (!apiBase) return Promise.reject(new Error("Service unavailable"));
    return fetch(`${apiBase}/api/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, language: currentLanguage }) }).then((response) => {
      if (!response.ok) throw new Error("Could not record question");
      return response.json();
    });
  }
  function answerAssistant(question) {
    const text = question.toLowerCase();
    if (text.includes("tanzania") || text.includes("crop") || text.includes("zao")) return currentLanguage === "sw" ? "Tanzania hulima mahindi, mpunga, mihogo, maharage, kahawa, korosho, alizeti, ufuta, ndizi na nyanya. Anza kwa kuchagua mkoa na muda wa mavuno." : "Tanzania grows maize, rice, cassava, beans, coffee, cashew, sunflower, sesame, bananas and tomatoes. Start by choosing a region and harvest timing.";
    if (text.includes("maize") || text.includes("mahindi")) return currentLanguage === "sw" ? "Ili kutangaza mahindi, chagua Mkulima, ongeza jina, mawasiliano, eneo, kiasi na muda wa mavuno. Wakala anaweza kusaidia kuratibu ukusanyaji." : "To list maize, choose Farmer, add your name, contact, location, quantity and harvest timing. An agent can then help coordinate collection.";
    if (text.includes("rice") || text.includes("mpunga") || text.includes("buy")) return currentLanguage === "sw" ? "Wanunuzi wanaweza kutafuta kwenye ubao wa soko, kuchuja kwa wakala au mkulima, kisha kuomba maelezo ya zao linalolingana na mahitaji yao." : "Buyers can search the market board, filter by agent or farmer, then request details from the listing that matches their quantity and pickup needs.";
    if (text.includes("buyer") || text.includes("mnunuzi")) return currentLanguage === "sw" ? "Ili kupata mnunuzi, weka zao, kiasi, eneo na muda wa kuchukua kwenye ubao wa soko. Wakala anaweza kusaidia kuunganisha mahitaji na usambazaji." : "To find a buyer, publish the crop, quantity, location, and pickup timing on the market board. An agent can help match demand with supply.";
    if (text.includes("agent") || text.includes("wakala")) return currentLanguage === "sw" ? "Wakala huratibu ukusanyaji, usafiri na mawasiliano kati ya mkulima na mnunuzi. Chagua nafasi ya Wakala ili kujiunga na mtandao." : "Agents coordinate collection, transport, and communication between farmers and buyers. Choose the Agent role to join the network.";
    if (text.includes("store") || text.includes("hifadhi")) return currentLanguage === "sw" ? "Hifadhi mahindi yaliyokauka kwenye mifuko safi, sehemu kavu yenye hewa, na juu ya pallet. Kagua mara kwa mara dhidi ya unyevu na wadudu." : "Store dry maize in clean bags in a cool, ventilated place above the floor. Check regularly for moisture and pests.";
    if (text.includes("cashew") || text.includes("korosho")) return currentLanguage === "sw" ? "Korosho zikauke vizuri, zichambuliwe, na zihifadhiwe sehemu kavu kabla ya kuuzwa. Ongeza eneo na kiasi ili wanunuzi wapate maelezo sahihi." : "Dry and grade cashews carefully, then keep them in a dry place before selling. Add location and quantity so buyers can assess the listing.";
    if (text.includes("region") || text.includes("mkoa")) return currentLanguage === "sw" ? "Mahindi hupatikana kwa wingi Iringa na Ruvuma, mpunga Morogoro na Mbeya, na korosho Mtwara na Lindi. Upatikanaji hutegemea msimu." : "Maize is widely grown in Iringa and Ruvuma, rice in Morogoro and Mbeya, and cashew in Mtwara and Lindi. Availability depends on the season.";
    const fallback = currentLanguage === "sw" ? "Bado sijawa na jibu la swali hili. Tuma swali lako kwa timu ya ShambaLink ili tulitafutie jibu." : "I don’t have a ready answer for that yet. Send the question to the ShambaLink team and we’ll add the answer.";
    assistantResponse.innerHTML = `<div class="assistant-fallback"><p>${fallback}</p><button type="button" data-send-question>${currentLanguage === "sw" ? "Tuma kwa timu" : "Send to the team"}</button></div>`;
    assistantResponse.querySelector("[data-send-question]").addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      submitUnansweredQuestion(question).then(() => {
        event.currentTarget.textContent = currentLanguage === "sw" ? "Limerekodiwa ✓" : "Question recorded ✓";
      }).catch(() => {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = currentLanguage === "sw" ? "Jaribu tena" : "Try again";
      });
    });
    return "";
  }
  assistantToggle?.addEventListener("click", () => {
    const open = assistantToggle.getAttribute("aria-expanded") === "true";
    assistantToggle.setAttribute("aria-expanded", String(!open));
    assistantPanel.hidden = open;
    if (!open) assistantInput.focus();
  });
  assistantClose?.addEventListener("click", () => { assistantPanel.hidden = true; assistantToggle.setAttribute("aria-expanded", "false"); });
  renderAssistantSuggestions();
  document.querySelector("#assistant-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const answer = answerAssistant(assistantInput.value);
    if (answer) assistantResponse.textContent = answer;
  });
})();
