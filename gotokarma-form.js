window.GKFormApp = (() => {
  const MAPBOX_TOKEN = "pk.eyJ1IjoibWF0aGlldWNjIiwiYSI6ImNtYXhwcnVrOTAxMGEybHM2cTV0OWF1a2gifQ.ILRDhx9lJUXpiDe1-_I5jQ";
  const CLOUDINARY_CLOUD_NAME = "dfued8fzu";
  const CLOUDINARY_UPLOAD_PRESET = "Gotokarma";
  const TOTAL_STEPS = 21;

  const DEFAULT_FORM_DATA = {
    categories: [],

    title: "",

    listingId: null,

    address: "",
    addressLat: null,
    addressLng: null,

    dateType: null,
    oneTimeStart: "",
    oneTimeEnd: "",
    multipleDates: [],
    periodStart: "",
    periodEnd: "",
    recurringFrequency: "",
    recurringDays: [],
    recurringStart: "",
    recurringEnd: "",

    description: "",
    experienceLevel: "",
    programSummary: "",

    includedOptions: [],
    customIncludedOptions: [],

    accommodations: [],
    accommodationFacilities: [],
    customAccommodationFacilities: [],

    programMode: "",
    dailyProgramItems: [],
    programDays: [],
    checkInTime: "",
    checkOutTime: "",

    images: [],

    organizer: {
      name: "",
      bio: "",
      photo: "",
      experience: ""
    },

    addons: [],

    cancellationPolicy: "",

    food: {
      mealsIncluded: false,
      mealTypes: [],
      drinksIncluded: false,
      dietOptions: [],
      customDietOptions: []
    },

    locationDetails: {
      description: "",
      facilities: [],
      customFacilities: []
    },

    travelLogistics: {
      howToGetThere: "",
      recommendedTransport: "",
      pickupAvailable: false,
      pickupDetails: ""
    },

    businessSettings: {
      commissionPercent: "",
      boostListing: false
    },

    currentStep: 1,
    status: "draft"
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const state = {
    currentStep: 1,
    listingId: null,
    stepActions: {},

    isDirty: false,
    isExplicitlySaving: false,

    editingAccommodationIndex: null,
    editingDailyProgramIndex: null,
    editingProgramDayIndex: null,
    editingAddonIndex: null,

    addressResults: [],
    addressDebounce: null,

    formData: deepClone(DEFAULT_FORM_DATA)
  };

  function mergeDeep(target, source) {
    const output = Array.isArray(target) ? [...target] : { ...target };

    if (source && typeof source === "object") {
      Object.keys(source).forEach(key => {
        if (Array.isArray(source[key])) {
          output[key] = [...source[key]];
        } else if (source[key] && typeof source[key] === "object") {
          output[key] = mergeDeep(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getEffectiveListingId() {
  return (
    state.listingId ||
    state.formData.listingId ||
    getQueryParam("id") ||
    sessionStorage.getItem("gk_listing_id") ||
    null
  );
}

function persistListingId(listingId) {
  if (!listingId) return;

  state.listingId = listingId;
  state.formData.listingId = listingId;
  sessionStorage.setItem("gk_listing_id", listingId);

  const url = new URL(window.location.href);
  url.searchParams.set("id", listingId);
  window.history.replaceState({}, "", url.toString());
}

  function emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, {
      detail: {
        ...detail,
        state,
        formData: state.formData
      }
    }));
  }

  function normalizeLabel(label) {
    return (label || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function generateCustomValue(label, prefix = "custom") {
    const normalized = normalizeLabel(label);
    return normalized ? `${prefix}_${normalized}` : "";
  }

  function markDirty() {
    state.isDirty = true;
  }

  function markClean() {
    state.isDirty = false;
  }

  function saveStateToStorage() {
    // volontairement vide
  }

  function loadStateFromStorage() {
  state.formData = deepClone(DEFAULT_FORM_DATA);
  state.currentStep = 1;
  state.listingId = null;
  state.isDirty = false;
  state.isExplicitlySaving = false;

  const listingIdFromUrl = getQueryParam("id");
  const listingIdFromSession = sessionStorage.getItem("gk_listing_id");
  const effectiveId = listingIdFromUrl || listingIdFromSession || null;

  if (effectiveId) {
    state.listingId = effectiveId;
    state.formData.listingId = effectiveId;
  }
}

  function clearSavedDraftLocal() {
    state.currentStep = 1;
    state.listingId = null;
    state.isDirty = false;
    state.isExplicitlySaving = false;
    state.editingAccommodationIndex = null;
    state.editingDailyProgramIndex = null;
    state.editingProgramDayIndex = null;
    state.editingAddonIndex = null;
    state.addressResults = [];
    state.addressDebounce = null;
    state.formData = deepClone(DEFAULT_FORM_DATA);

    emit("gk:reset");
  }

  function updateProgress() {
    const fill = $(".fixed-step-progress-fill");
    if (fill) {
      fill.style.width = ((state.currentStep - 1) / TOTAL_STEPS) * 100 + "%";
    }

    const currentStepEls = $$(".current-step-number");
    currentStepEls.forEach(el => {
      el.textContent = String(state.currentStep);
    });

    const totalStepEls = $$(".total-step-number");
    totalStepEls.forEach(el => {
      el.textContent = String(TOTAL_STEPS);
    });
  }

  function showStep(step) {
  const normalizedStep = Math.max(1, Math.min(TOTAL_STEPS, Number(step) || 1));

  for (let i = 1; i <= TOTAL_STEPS; i += 1) {
    document.querySelectorAll(`.step-${i}`).forEach(el => {
      el.style.display = "none";
      el.setAttribute("data-gk-visible", "false");
    });
  }

  document.querySelectorAll(`.step-${normalizedStep}`).forEach(el => {
    el.style.display = "block";
    el.setAttribute("data-gk-visible", "true");
  });

  state.currentStep = normalizedStep;
  state.formData.currentStep = normalizedStep;

  updateProgress();
  saveStateToStorage();

  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  console.log("SHOW STEP:", normalizedStep);

  emit("gk:stepChanged", { step: normalizedStep });
}

  function nextStep() {
    if (state.currentStep < TOTAL_STEPS) {
      showStep(state.currentStep + 1);
    }
  }

  function prevStep() {
    if (state.currentStep > 1) {
      showStep(state.currentStep - 1);
    }
  }

  function goToStep(step) {
    showStep(step);
  }

  function getCurrentStepElement() {
    return $(`.step-${state.currentStep}`);
  }

  function clearError(stepEl) {
    if (!stepEl) return;

    const inputs = stepEl.querySelectorAll("input, textarea, select");
    const errors = stepEl.querySelectorAll(
      ".field-error, .category-error, .date-type-error, .included-error, .facility-error, .step-error"
    );

    inputs.forEach(input => {
      input.style.borderColor = "";
    });

    errors.forEach(error => error.remove());
  }

  function buildErrorNode(message, className = "field-error") {
    const error = document.createElement("div");
    error.className = className;
    error.textContent = message;
    error.style.color = "#D93025";
    error.style.fontSize = "14px";
    error.style.marginTop = "8px";
    return error;
  }

  function showError(stepEl, message, className = "field-error", targetEl = null) {
    if (!stepEl) return;

    clearError(stepEl);

    const defaultTarget =
      targetEl ||
      stepEl.querySelector("input, textarea, select") ||
      stepEl.querySelector(".category-grid") ||
      stepEl.querySelector(".categories-grid") ||
      stepEl.querySelector(".date-type-grid") ||
      stepEl.querySelector(".date-types-grid") ||
      stepEl.querySelector(".included-options-grid") ||
      stepEl.querySelector(".accommodation-facilities-grid") ||
      stepEl.querySelector(".step-actions") ||
      stepEl;

    if (defaultTarget && ["INPUT", "TEXTAREA", "SELECT"].includes(defaultTarget.tagName)) {
      defaultTarget.style.borderColor = "#D93025";
    }

    const errorNode = buildErrorNode(message, className);
    defaultTarget.insertAdjacentElement("afterend", errorNode);
  }

  function bindAutoClearErrors() {
    document.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const stepEl = target.closest('[class^="step-"]');
      if (stepEl) clearError(stepEl);
    });

    document.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const stepEl = target.closest('[class^="step-"]');
      if (stepEl) clearError(stepEl);
    });
  }

  function bindBeforeUnloadProtection() {
    window.addEventListener("beforeunload", (e) => {
      if (!state.isDirty) return;
      if (state.isExplicitlySaving) return;

      e.preventDefault();
      e.returnValue = "";
    });
  }

  async function parseResponseSafely(response) {
    const rawText = await response.text();
    let data = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = null;
    }

    return { rawText, data };
  }

    async function refreshAccessTokenIfNeeded() {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      throw new Error("Aucun refresh token disponible.");
    }

    const body = new URLSearchParams({
      client_id: window.SHARETRIBE_CLIENT_ID || "121db1ac-ac2b-4435-aa87-e83976113ffa",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "user"
    });

    const response = await fetch("https://flex-api.sharetribe.com/v1/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: body.toString()
    });

    const { rawText, data } = await parseResponseSafely(response);

    if (!response.ok) {
      throw new Error(
        data?.error_description ||
        data?.error ||
        rawText ||
        "Impossible de refresh le token."
      );
    }

    localStorage.setItem("accessToken", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refreshToken", data.refresh_token);
    }

    return data.access_token;
  }

  async function getValidAccessToken() {
    let token = localStorage.getItem("accessToken");

    if (!token) {
      throw new Error("Aucun access token disponible.");
    }

    return token;
  }

  async function fetchWithAuthRetry(url, options = {}) {
    let token = await getValidAccessToken();

    const makeRequest = async (bearerToken) => {
      const headers = {
        ...(options.headers || {}),
        Authorization: "bearer " + bearerToken
      };

      return fetch(url, {
        ...options,
        headers
      });
    };

    let response = await makeRequest(token);

    if (response.status === 401) {
      token = await refreshAccessTokenIfNeeded();
      response = await makeRequest(token);
    }

    return response;
  }

  async function fetchOwnListing(listingId) {
    const response = await fetchWithAuthRetry(
      `https://flex-api.sharetribe.com/v1/api/own_listings/show?id=${encodeURIComponent(listingId)}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    const { rawText, data } = await parseResponseSafely(response);

    if (!response.ok) {
      const message =
        data?.errors?.[0]?.title ||
        data?.errors?.[0]?.detail ||
        data?.error_description ||
        data?.error ||
        rawText ||
        "Impossible de charger le draft";

      throw new Error(message);
    }

    return data;
  }

  function hydrateStateFromListingResponse(payload) {
  const listing = payload?.data || {};
  const attrs = listing?.attributes || {};
  const publicData = attrs?.publicData || {};
  const draftSnapshot = publicData?.draftSnapshot || {};

  const listingId = listing?.id?.uuid || listing?.id || null;
  if (listingId) {
    persistListingId(listingId);
  }

  state.formData = mergeDeep(
    deepClone(DEFAULT_FORM_DATA),
    draftSnapshot
  );

  state.formData.title = draftSnapshot.title || attrs.title || state.formData.title || "";
  state.formData.description = draftSnapshot.description || attrs.description || state.formData.description || "";
  state.formData.status = draftSnapshot.status || publicData.status || "draft";
  state.formData.currentStep = Number(draftSnapshot.currentStep || publicData.currentStep || 1) || 1;
  state.formData.listingId = listingId || state.formData.listingId || null;

  state.currentStep = state.formData.currentStep;
  state.isDirty = false;
}

  async function uploadImageToCloudinary(file) {
    if (!file) {
      throw new Error("Aucun fichier sélectionné.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "gotokarma");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Erreur lors de l’upload de l’image.");
    }

    return {
      url: data.secure_url,
      publicId: data.public_id,
      name: file.name || ""
    };
  }

    async function createListingDraft(primaryCategory = null) {
  const existingId = getEffectiveListingId();

  if (existingId) {
    persistListingId(existingId);
    return existingId;
  }

  const response = await fetchWithAuthRetry(
    "https://flex-api.sharetribe.com/v1/api/own_listings/create_draft",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        title: state.formData.title || "Brouillon",
        description: state.formData.description || "Draft en cours de création",
        publicData: {
          primaryCategory: primaryCategory || state.formData.categories[0] || null,
          ...buildCleanPublicData()
        }
      })
    }
  );

  const { rawText, data } = await parseResponseSafely(response);

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.title ||
      data?.errors?.[0]?.detail ||
      data?.error_description ||
      data?.error ||
      rawText ||
      "Impossible de créer le draft";

    throw new Error(message);
  }

  const listingId = data?.data?.id?.uuid || data?.data?.id || null;
  persistListingId(listingId);

  markDirty();

  emit("gk:draftCreated", {
    listingId,
    response: data
  });

  return listingId;
}

    async function updateListingDraft(dataToUpdate = {}) {
  const effectiveListingId = getEffectiveListingId();

  if (!effectiveListingId) {
    throw new Error("Listing ID manquant");
  }

  persistListingId(effectiveListingId);

  const response = await fetchWithAuthRetry(
    "https://flex-api.sharetribe.com/v1/api/own_listings/update",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        id: effectiveListingId,
        ...dataToUpdate
      })
    }
  );

  const { rawText, data } = await parseResponseSafely(response);

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.title ||
      data?.errors?.[0]?.detail ||
      data?.error_description ||
      data?.error ||
      rawText ||
      "Impossible de mettre à jour le draft";

    throw new Error(message);
  }

  markDirty();

  emit("gk:draftUpdated", {
    response: data
  });

  return data;
}

  async function syncDraft(extra = {}) {
  const effectiveListingId = getEffectiveListingId();

  if (!effectiveListingId) {
    throw new Error("Listing ID toujours manquant (syncDraft)");
  }

  persistListingId(effectiveListingId);

  const cleanPublicData = buildCleanPublicData();

  return updateListingDraft({
    id: effectiveListingId,
    title: state.formData.title || "Brouillon",
    description: state.formData.description || "Draft en cours de création",
    publicData: {
      primaryCategory: state.formData.categories[0] || null,
      ...cleanPublicData
    },
    ...extra
  });
}
    async function publishDraft() {
    const token = localStorage.getItem("accessToken");

    if (!token) {
      window.location.href = "/login?redirect=/devenir-organisateur";
      return;
    }

    if (!state.listingId) {
      throw new Error("Listing ID manquant");
    }

    const response = await fetch("https://flex-api.sharetribe.com/v1/api/own_listings/publish_draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "bearer " + token,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        id: state.listingId
      })
    });

    const { rawText, data } = await parseResponseSafely(response);

    if (!response.ok) {
      const message =
        data?.errors?.[0]?.title ||
        data?.errors?.[0]?.detail ||
        data?.error_description ||
        data?.error ||
        rawText ||
        "Impossible de publier le draft";

      throw new Error(message);
    }

    state.formData.status = "published";
    saveStateToStorage();

    emit("gk:draftPublished", {
      response: data
    });

    return data;
  }

  async function searchAddress(query) {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_TOKEN}&autocomplete=true&language=fr&limit=5`;

    const response = await fetch(url);
    const data = await response.json();

    return data.features || [];
  }

  function setAddressFromMapboxResult(result) {
    state.formData.address = result?.place_name || "";
    state.formData.addressLng = result?.center?.[0] || null;
    state.formData.addressLat = result?.center?.[1] || null;
    markDirty();

    emit("gk:addressSelected", { result });
  }

  function resetAddressSelection() {
    state.formData.address = "";
    state.formData.addressLat = null;
    state.formData.addressLng = null;
    markDirty();
  }

  function toggleSelectionInArray(array, value, max = null) {
    const exists = array.includes(value);

    if (exists) {
      return {
        next: array.filter(v => v !== value),
        changed: true,
        added: false,
        removed: true,
        blocked: false
      };
    }

    if (max !== null && array.length >= max) {
      return {
        next: [...array],
        changed: false,
        added: false,
        removed: false,
        blocked: true
      };
    }

    return {
      next: [...array, value],
      changed: true,
      added: true,
      removed: false,
      blocked: false
    };
  }

  function toggleCategory(value, max = 3) {
    const result = toggleSelectionInArray(state.formData.categories, value, max);
    if (result.changed) {
      state.formData.categories = result.next;
      markDirty();
      emit("gk:categoriesChanged", { value, result });
    }
    return result;
  }

  function setDateType(value) {
    state.formData.dateType = value || null;
    markDirty();
    emit("gk:dateTypeChanged", { value: state.formData.dateType });
  }

  function hideAllDateFields() {
    [
      ".date-fields-one-time",
      ".date-fields-multiple",
      ".date-fields-period",
      ".date-fields-recurring"
    ].forEach(selector => {
      const el = $(selector);
      if (el) el.style.display = "none";
    });
  }

  function showDateFieldsByType(type) {
    hideAllDateFields();

    if (type === "one_time") {
      const el = $(".date-fields-one-time");
      if (el) el.style.display = "block";
    }

    if (type === "multiple_dates") {
      const el = $(".date-fields-multiple");
      if (el) el.style.display = "block";
    }

    if (type === "period") {
      const el = $(".date-fields-period");
      if (el) el.style.display = "block";
    }

    if (type === "recurring") {
      const el = $(".date-fields-recurring");
      if (el) el.style.display = "block";
    }
  }

  function toggleRecurringDay(dayValue) {
    const result = toggleSelectionInArray(state.formData.recurringDays, dayValue, null);
    if (result.changed) {
      state.formData.recurringDays = result.next;
      markDirty();
      emit("gk:recurringDaysChanged", { dayValue, result });
    }
    return result;
  }

  function toggleIncludedOption(value) {
    const result = toggleSelectionInArray(state.formData.includedOptions, value, null);
    if (result.changed) {
      state.formData.includedOptions = result.next;
      markDirty();
      emit("gk:includedOptionsChanged", { value, result });
    }
    return result;
  }

  function addCustomIncludedOption(label) {
    const cleanLabel = (label || "").trim();
    if (!cleanLabel) return null;

    const safeValue = generateCustomValue(cleanLabel, "custom");
    if (!safeValue) return null;

    if (!state.formData.customIncludedOptions.includes(cleanLabel)) {
      state.formData.customIncludedOptions.push(cleanLabel);
    }

    if (!state.formData.includedOptions.includes(safeValue)) {
      state.formData.includedOptions.push(safeValue);
    }

    markDirty();
    emit("gk:includedOptionsChanged", { value: safeValue, label: cleanLabel });

    return {
      label: cleanLabel,
      value: safeValue
    };
  }

  function removeCustomIncludedOption(label) {
    const cleanLabel = (label || "").trim();
    const safeValue = generateCustomValue(cleanLabel, "custom");

    state.formData.customIncludedOptions = state.formData.customIncludedOptions.filter(v => v !== cleanLabel);
    state.formData.includedOptions = state.formData.includedOptions.filter(v => v !== safeValue);

    markDirty();
    emit("gk:includedOptionsChanged", { value: safeValue, label: cleanLabel });
  }

  function toggleAccommodationFacility(value) {
    const result = toggleSelectionInArray(state.formData.accommodationFacilities, value, null);
    if (result.changed) {
      state.formData.accommodationFacilities = result.next;
      markDirty();
      emit("gk:accommodationFacilitiesChanged", { value, result });
    }
    return result;
  }

  function addCustomAccommodationFacility(label) {
    const cleanLabel = (label || "").trim();
    if (!cleanLabel) return null;

    const safeValue = generateCustomValue(cleanLabel, "custom");
    if (!safeValue) return null;

    if (!state.formData.customAccommodationFacilities.includes(cleanLabel)) {
      state.formData.customAccommodationFacilities.push(cleanLabel);
    }

    if (!state.formData.accommodationFacilities.includes(safeValue)) {
      state.formData.accommodationFacilities.push(safeValue);
    }

    markDirty();
    emit("gk:accommodationFacilitiesChanged", { value: safeValue, label: cleanLabel });

    return {
      label: cleanLabel,
      value: safeValue
    };
  }

  function removeCustomAccommodationFacility(label) {
    const cleanLabel = (label || "").trim();
    const safeValue = generateCustomValue(cleanLabel, "custom");

    state.formData.customAccommodationFacilities =
      state.formData.customAccommodationFacilities.filter(v => v !== cleanLabel);

    state.formData.accommodationFacilities =
      state.formData.accommodationFacilities.filter(v => v !== safeValue);

    markDirty();
    emit("gk:accommodationFacilitiesChanged", { value: safeValue, label: cleanLabel });
  }

  function resetAccommodationFormUI() {
    const ids = [
      "accommodation-name",
      "accommodation-type",
      "accommodation-capacity",
      "pricing-type",
      "accommodation-price",
      "accommodation-description",
      "accommodation-image-url"
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    state.formData.accommodationFacilities = [];
    state.formData.customAccommodationFacilities = [];
    state.editingAccommodationIndex = null;

    $$(".facility-card").forEach(card => {
      card.classList.remove("is-active");
    });

    const customWrap = $(".custom-facility-wrap");
    const customInput = $("#custom-facility-input");

    if (customWrap) customWrap.style.display = "none";
    if (customInput) customInput.value = "";

    emit("gk:accommodationChanged");
  }

  function fillAccommodationFormUI(accommodation, index) {
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    };

    setValue("accommodation-name", accommodation.name);
    setValue("accommodation-type", accommodation.type);
    setValue("accommodation-capacity", accommodation.capacity);
    setValue("pricing-type", accommodation.pricingType);
    setValue("accommodation-price", accommodation.price);
    setValue("accommodation-description", accommodation.description);

    state.formData.accommodationFacilities = [...(accommodation.facilities || [])];
    state.formData.customAccommodationFacilities = [...(accommodation.customFacilities || [])];
    state.editingAccommodationIndex = index;

    $$(".facility-card").forEach(card => {
      const value = card.getAttribute("data-facility");
      card.classList.toggle("is-active", state.formData.accommodationFacilities.includes(value));
    });

    emit("gk:accommodationChanged", { index, accommodation });
  }

  function getCurrentAccommodationImages() {
    const idx = state.editingAccommodationIndex;
    if (idx === null) return [];
    return state.formData.accommodations[idx]?.images || [];
  }

  function addAccommodationImage(image) {
    const cleanUrl =
      typeof image === "string"
        ? image.trim()
        : (image?.url || "").trim();

    if (!cleanUrl) return false;
    if (state.editingAccommodationIndex === null) return false;

    const accommodation = state.formData.accommodations[state.editingAccommodationIndex];
    if (!accommodation) return false;

    if (!Array.isArray(accommodation.images)) {
      accommodation.images = [];
    }

    accommodation.images.push({
      url: cleanUrl,
      publicId: image?.publicId || "",
      name: image?.name || ""
    });

    markDirty();
    emit("gk:accommodationImagesChanged", { index: state.editingAccommodationIndex });

    return true;
  }

  function removeAccommodationImage(imageIndex) {
    if (state.editingAccommodationIndex === null) return;

    const accommodation = state.formData.accommodations[state.editingAccommodationIndex];
    if (!accommodation || !Array.isArray(accommodation.images)) return;

    accommodation.images.splice(imageIndex, 1);
    markDirty();
    emit("gk:accommodationImagesChanged", { index: state.editingAccommodationIndex });
  }
    async function saveCurrentAccommodation(stepEl) {
    const accommodationName = $("#accommodation-name")?.value.trim() || "";
    const accommodationType = $("#accommodation-type")?.value || "";
    const accommodationCapacity = $("#accommodation-capacity")?.value || "";
    const pricingType = $("#pricing-type")?.value || "";
    const accommodationPrice = $("#accommodation-price")?.value || "";
    const accommodationDescription = $("#accommodation-description")?.value.trim() || "";

    if (!accommodationName || !accommodationType || !accommodationCapacity || !pricingType || !accommodationPrice) {
      showError(stepEl, "Merci de remplir tous les champs du logement.");
      return false;
    }

    const previousAccommodations = deepClone(state.formData.accommodations);
    const previousEditingIndex = state.editingAccommodationIndex;

    const existingImages =
      state.editingAccommodationIndex !== null
        ? (state.formData.accommodations[state.editingAccommodationIndex]?.images || [])
        : [];

    const newAccommodation = {
      name: accommodationName,
      type: accommodationType,
      capacity: accommodationCapacity,
      pricingType,
      price: accommodationPrice,
      description: accommodationDescription,
      facilities: [...state.formData.accommodationFacilities],
      customFacilities: [...state.formData.customAccommodationFacilities],
      images: existingImages
    };

    try {
      if (state.editingAccommodationIndex !== null) {
        state.formData.accommodations[state.editingAccommodationIndex] = newAccommodation;
      } else {
        state.formData.accommodations.push(newAccommodation);
      }

      markDirty();

      if (!state.listingId) {
        throw new Error("Listing ID manquant");
      }

      await syncDraft();

      emit("gk:accommodationListChanged");
      resetAccommodationFormUI();

      return true;
    } catch (error) {
      state.formData.accommodations = previousAccommodations;
      state.editingAccommodationIndex = previousEditingIndex;

      emit("gk:accommodationListChanged");

      throw error;
    }
  }

  async function deleteAccommodation(index) {
    state.formData.accommodations.splice(index, 1);

    if (state.editingAccommodationIndex === index) {
      resetAccommodationFormUI();
    } else if (state.editingAccommodationIndex !== null && state.editingAccommodationIndex > index) {
      state.editingAccommodationIndex -= 1;
    }

    markDirty();
    emit("gk:accommodationListChanged");

    return syncDraft();
  }

  function setProgramMode(mode) {
    state.formData.programMode = mode || "";
    markDirty();
    emit("gk:programModeChanged", { mode: state.formData.programMode });
  }

  function hideProgramModeFields() {
    const sameWrap = $(".program-mode-same");
    const byDayWrap = $(".program-mode-by-day");

    if (sameWrap) sameWrap.style.display = "none";
    if (byDayWrap) byDayWrap.style.display = "none";
  }

  function showProgramModeFields(mode) {
    hideProgramModeFields();

    if (mode === "same_each_day") {
      const sameWrap = $(".program-mode-same");
      if (sameWrap) sameWrap.style.display = "block";
    }

    if (mode === "by_day") {
      const byDayWrap = $(".program-mode-by-day");
      if (byDayWrap) byDayWrap.style.display = "block";
    }
  }

  function resetDailyProgramForm() {
    const timeEl = $("#daily-program-time");
    const titleEl = $("#daily-program-title");
    const descEl = $("#daily-program-description");

    if (timeEl) timeEl.value = "";
    if (titleEl) titleEl.value = "";
    if (descEl) descEl.value = "";

    state.editingDailyProgramIndex = null;
    emit("gk:dailyProgramChanged");
  }

  function saveDailyProgramItem(stepEl) {
    const time = $("#daily-program-time")?.value.trim() || "";
    const title = $("#daily-program-title")?.value.trim() || "";
    const description = $("#daily-program-description")?.value.trim() || "";

    if (!time || !title) {
      showError(stepEl, "Merci de renseigner l’heure et le titre de l’activité.");
      return false;
    }

    const item = { time, title, description };

    if (state.editingDailyProgramIndex !== null) {
      state.formData.dailyProgramItems[state.editingDailyProgramIndex] = item;
    } else {
      state.formData.dailyProgramItems.push(item);
    }

    state.formData.dailyProgramItems.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    markDirty();
    resetDailyProgramForm();
    emit("gk:dailyProgramChanged");

    return true;
  }

  function editDailyProgramItem(index) {
    const item = state.formData.dailyProgramItems[index];
    if (!item) return;

    const timeEl = $("#daily-program-time");
    const titleEl = $("#daily-program-title");
    const descEl = $("#daily-program-description");

    if (timeEl) timeEl.value = item.time || "";
    if (titleEl) titleEl.value = item.title || "";
    if (descEl) descEl.value = item.description || "";

    state.editingDailyProgramIndex = index;
    emit("gk:dailyProgramChanged", { index });
  }

  function deleteDailyProgramItem(index) {
    state.formData.dailyProgramItems.splice(index, 1);

    if (state.editingDailyProgramIndex === index) {
      resetDailyProgramForm();
    } else if (state.editingDailyProgramIndex !== null && state.editingDailyProgramIndex > index) {
      state.editingDailyProgramIndex -= 1;
    }

    markDirty();
    emit("gk:dailyProgramChanged");
  }

  function resetProgramDayForm() {
    const input = $("#program-day-title");
    if (input) input.value = "";
    state.editingProgramDayIndex = null;
    emit("gk:programDaysChanged");
  }

  function saveProgramDay(stepEl) {
    const dayTitle = $("#program-day-title")?.value.trim() || "";

    if (!dayTitle) {
      showError(stepEl, "Merci de renseigner le titre du jour.");
      return false;
    }

    const currentActivities =
      state.editingProgramDayIndex !== null
        ? (state.formData.programDays[state.editingProgramDayIndex]?.activities || [])
        : [];

    const dayData = {
      dayTitle,
      activities: [...currentActivities]
    };

    if (state.editingProgramDayIndex !== null) {
      state.formData.programDays[state.editingProgramDayIndex] = dayData;
    } else {
      state.formData.programDays.push(dayData);
    }

    state.formData.programDays.sort((a, b) =>
      (a.dayTitle || "").localeCompare(b.dayTitle || "", undefined, { numeric: true })
    );

    markDirty();
    resetProgramDayForm();
    emit("gk:programDaysChanged");

    return true;
  }

  function editProgramDay(index) {
    const day = state.formData.programDays[index];
    const input = $("#program-day-title");
    if (!day || !input) return;

    input.value = day.dayTitle || "";
    state.editingProgramDayIndex = index;
    emit("gk:programDaysChanged", { index });
  }

  function deleteProgramDay(index) {
    state.formData.programDays.splice(index, 1);

    if (state.editingProgramDayIndex === index) {
      resetProgramDayForm();
    } else if (state.editingProgramDayIndex !== null && state.editingProgramDayIndex > index) {
      state.editingProgramDayIndex -= 1;
    }

    markDirty();
    emit("gk:programDaysChanged");
  }

  function addProgramActivity(dayIndex, activity) {
    const day = state.formData.programDays[dayIndex];
    if (!day) return false;

    const cleanActivity = {
      time: (activity?.time || "").trim(),
      title: (activity?.title || "").trim(),
      description: (activity?.description || "").trim()
    };

    if (!cleanActivity.time || !cleanActivity.title) return false;

    if (!Array.isArray(day.activities)) {
      day.activities = [];
    }

    day.activities.push(cleanActivity);
    day.activities.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    markDirty();
    emit("gk:programDaysChanged", { dayIndex });

    return true;
  }

  function deleteProgramActivity(dayIndex, activityIndex) {
    const day = state.formData.programDays[dayIndex];
    if (!day || !Array.isArray(day.activities)) return;

    day.activities.splice(activityIndex, 1);
    markDirty();
    emit("gk:programDaysChanged", { dayIndex });
  }

  function addListingImage(image) {
    const cleanUrl =
      typeof image === "string"
        ? image.trim()
        : (image?.url || "").trim();

    if (!cleanUrl) return false;

    const imageObject = {
      url: cleanUrl,
      publicId: image?.publicId || "",
      name: image?.name || ""
    };

    state.formData.images.push(imageObject);
    markDirty();
    emit("gk:listingImagesChanged");

    return true;
  }

  function removeListingImage(index) {
    state.formData.images.splice(index, 1);
    markDirty();
    emit("gk:listingImagesChanged");
  }

  function updateOrganizer(data = {}) {
    state.formData.organizer = {
      ...state.formData.organizer,
      ...data
    };

    markDirty();
    emit("gk:organizerChanged");
  }

  function resetAddonForm() {
    const ids = ["addon-name", "addon-price", "addon-description"];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    state.editingAddonIndex = null;
    emit("gk:addonsChanged");
  }

  function saveAddon(stepEl) {
    const name = $("#addon-name")?.value.trim() || "";
    const price = $("#addon-price")?.value.trim() || "";
    const description = $("#addon-description")?.value.trim() || "";

    if (!name || !price) {
      showError(stepEl, "Merci de renseigner au minimum le nom et le prix de l’add-on.");
      return false;
    }

    const addon = { name, price, description };

    if (state.editingAddonIndex !== null) {
      state.formData.addons[state.editingAddonIndex] = addon;
    } else {
      state.formData.addons.push(addon);
    }

    markDirty();
    resetAddonForm();
    emit("gk:addonsChanged");

    return true;
  }

  function editAddon(index) {
    const addon = state.formData.addons[index];
    if (!addon) return;

    const nameEl = $("#addon-name");
    const priceEl = $("#addon-price");
    const descEl = $("#addon-description");

    if (nameEl) nameEl.value = addon.name || "";
    if (priceEl) priceEl.value = addon.price || "";
    if (descEl) descEl.value = addon.description || "";

    state.editingAddonIndex = index;
    emit("gk:addonsChanged", { index });
  }

  function deleteAddon(index) {
    state.formData.addons.splice(index, 1);

    if (state.editingAddonIndex === index) {
      resetAddonForm();
    } else if (state.editingAddonIndex !== null && state.editingAddonIndex > index) {
      state.editingAddonIndex -= 1;
    }

    markDirty();
    emit("gk:addonsChanged");
  }
    function setCancellationPolicy(value) {
    state.formData.cancellationPolicy = value || "";
    markDirty();
    emit("gk:cancellationPolicyChanged", { value: state.formData.cancellationPolicy });
  }

  function setMealsIncluded(value) {
    state.formData.food.mealsIncluded = !!value;
    markDirty();
    emit("gk:foodChanged");
  }

  function setDrinksIncluded(value) {
    state.formData.food.drinksIncluded = !!value;
    markDirty();
    emit("gk:foodChanged");
  }

  function toggleMealType(value) {
    const result = toggleSelectionInArray(state.formData.food.mealTypes, value, null);
    if (result.changed) {
      state.formData.food.mealTypes = result.next;
      markDirty();
      emit("gk:foodChanged", { value, result });
    }
    return result;
  }

  function toggleDietOption(value) {
    const result = toggleSelectionInArray(state.formData.food.dietOptions, value, null);
    if (result.changed) {
      state.formData.food.dietOptions = result.next;
      markDirty();
      emit("gk:foodChanged", { value, result });
    }
    return result;
  }

  function addCustomDietOption(label) {
    const cleanLabel = (label || "").trim();
    if (!cleanLabel) return null;

    if (!state.formData.food.customDietOptions.includes(cleanLabel)) {
      state.formData.food.customDietOptions.push(cleanLabel);
    }

    markDirty();
    emit("gk:foodChanged", { label: cleanLabel });

    return cleanLabel;
  }

  function removeCustomDietOption(label) {
    const cleanLabel = (label || "").trim();
    state.formData.food.customDietOptions =
      state.formData.food.customDietOptions.filter(v => v !== cleanLabel);

    markDirty();
    emit("gk:foodChanged", { label: cleanLabel });
  }

  function updateLocationDetails(data = {}) {
    state.formData.locationDetails = {
      ...state.formData.locationDetails,
      ...data
    };

    markDirty();
    emit("gk:locationDetailsChanged");
  }

  function toggleLocationFacility(value) {
    const result = toggleSelectionInArray(state.formData.locationDetails.facilities, value, null);
    if (result.changed) {
      state.formData.locationDetails.facilities = result.next;
      markDirty();
      emit("gk:locationDetailsChanged", { value, result });
    }
    return result;
  }

  function addCustomLocationFacility(label) {
    const cleanLabel = (label || "").trim();
    if (!cleanLabel) return null;

    if (!state.formData.locationDetails.customFacilities.includes(cleanLabel)) {
      state.formData.locationDetails.customFacilities.push(cleanLabel);
    }

    markDirty();
    emit("gk:locationDetailsChanged", { label: cleanLabel });

    return cleanLabel;
  }

  function removeCustomLocationFacility(label) {
    const cleanLabel = (label || "").trim();
    state.formData.locationDetails.customFacilities =
      state.formData.locationDetails.customFacilities.filter(v => v !== cleanLabel);

    markDirty();
    emit("gk:locationDetailsChanged", { label: cleanLabel });
  }

  function updateTravelLogistics(data = {}) {
    state.formData.travelLogistics = {
      ...state.formData.travelLogistics,
      ...data
    };

    markDirty();
    emit("gk:travelLogisticsChanged");
  }

  function updateBusinessSettings(data = {}) {
    state.formData.businessSettings = {
      ...state.formData.businessSettings,
      ...data
    };

    markDirty();
    emit("gk:businessSettingsChanged");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isNaN(num) ? null : num;
  }

  function getCleanDates(formData) {
    let start = "";
    let end = "";

    if (formData.dateType === "one_time") {
      start = formData.oneTimeStart || "";
      end = formData.oneTimeEnd || "";
    }

    if (formData.dateType === "multiple_dates") {
      start = formData.multipleDates?.[0]?.start || "";
      end = formData.multipleDates?.[0]?.end || "";
    }

    if (formData.dateType === "period") {
      start = formData.periodStart || "";
      end = formData.periodEnd || "";
    }

    if (formData.dateType === "recurring") {
      start = formData.recurringStart || "";
      end = formData.recurringEnd || "";
    }

    let durationDays = null;
    let durationNights = null;

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const diffMs = endDate.getTime() - startDate.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        durationDays = days > 0 ? days : 1;
        durationNights = Math.max(durationDays - 1, 1);
      }
    }

    return {
      type: formData.dateType || "",
      start,
      end,
      durationDays,
      durationNights
    };
  }

  function buildCleanPublicData() {
    const formData = state.formData;
    const cleanDates = getCleanDates(formData);

    const cleanAccommodations = (formData.accommodations || []).map(acc => ({
      name: acc.name || "",
      type: acc.type || "",
      capacity: toNumber(acc.capacity),
      pricingType: acc.pricingType || "",
      price: toNumber(acc.price),
      currency: "EUR",
      facilities: Array.isArray(acc.facilities) ? acc.facilities : [],
      description: acc.description || "",
      images: Array.isArray(acc.images)
        ? acc.images
            .map(img => {
              if (typeof img === "string") return { url: img };
              if (img && typeof img.url === "string") return { url: img.url };
              return null;
            })
            .filter(Boolean)
        : []
    }));

    const cleanAddons = (formData.addons || []).map(addon => ({
      name: addon.name || "",
      price: toNumber(addon.price),
      currency: "EUR",
      description: addon.description || ""
    }));

    const cleanProgram =
      formData.programMode === "same_each_day"
        ? [
            {
              dayTitle: "Programme type",
              activities: Array.isArray(formData.dailyProgramItems)
                ? formData.dailyProgramItems.map(item => ({
                    time: item.time || "",
                    title: item.title || "",
                    description: item.description || ""
                  }))
                : []
            }
          ]
        : Array.isArray(formData.programDays)
          ? formData.programDays.map(day => ({
              dayTitle: day.dayTitle || "",
              activities: Array.isArray(day.activities)
                ? day.activities.map(item => ({
                    time: item.time || "",
                    title: item.title || "",
                    description: item.description || ""
                  }))
                : []
            }))
          : [];

    const included = Array.isArray(formData.includedOptions)
      ? formData.includedOptions
      : [];

    const excluded = [
      "Transport jusqu’au lieu",
      "Assurance voyage",
      "Dépenses personnelles"
    ];

    const cleanListingImages = Array.isArray(formData.images)
      ? formData.images
          .map(img => {
            if (typeof img === "string") return { url: img };
            if (img && typeof img.url === "string") return { url: img.url };
            return null;
          })
          .filter(Boolean)
      : [];

    const snapshot = deepClone(formData);
    snapshot.currentStep = state.currentStep || formData.currentStep || 1;

    return {
      title: formData.title || "",
      slug: slugify(formData.title || ""),
      status: formData.status === "published" ? "pending_review" : "draft",
      currentStep: state.currentStep || formData.currentStep || 1,
      draftSnapshot: snapshot,

      categories: Array.isArray(formData.categories) ? formData.categories : [],

      address: formData.address || "",
      addressLat: formData.addressLat ?? null,
      addressLng: formData.addressLng ?? null,

      dates: cleanDates,

      heroImage: cleanListingImages.length ? cleanListingImages[0].url : "",
      images: cleanListingImages,

      description: formData.description || "",

      included,
      excluded,

      accommodations: cleanAccommodations,
      addons: cleanAddons,
      program: cleanProgram,

      practices: [],

      experienceLevel: formData.experienceLevel || "",

      food: {
        mealsIncluded: !!formData.food?.mealsIncluded,
        mealTypes: Array.isArray(formData.food?.mealTypes) ? formData.food.mealTypes : [],
        drinksIncluded: !!formData.food?.drinksIncluded,
        dietOptions: Array.isArray(formData.food?.dietOptions) ? formData.food.dietOptions : [],
        customDietOptions: Array.isArray(formData.food?.customDietOptions) ? formData.food.customDietOptions : []
      },

      travel: {
        howToGetThere: formData.travelLogistics?.howToGetThere || "",
        recommendedTransport: formData.travelLogistics?.recommendedTransport || "",
        pickupAvailable: !!formData.travelLogistics?.pickupAvailable,
        pickupDetails: formData.travelLogistics?.pickupDetails || ""
      },

      locationDetails: {
        description: formData.locationDetails?.description || "",
        facilities: Array.isArray(formData.locationDetails?.facilities) ? formData.locationDetails.facilities : [],
        customFacilities: Array.isArray(formData.locationDetails?.customFacilities) ? formData.locationDetails.customFacilities : []
      },

      cancellationPolicy: formData.cancellationPolicy || "",

      organizer: {
        name: formData.organizer?.name || "",
        bio: formData.organizer?.bio || "",
        experience: formData.organizer?.experience || "",
        photo: formData.organizer?.photo || ""
      },

      visibilityPlan: {
        commissionPercent: toNumber(formData.businessSettings?.commissionPercent),
        label:
          String(formData.businessSettings?.commissionPercent || "") === "15"
            ? "premium"
            : String(formData.businessSettings?.commissionPercent || "") === "10"
              ? "boost"
              : "essential"
      }
    };
  }

  function getReviewData() {
    return {
      listingId: state.listingId,
      currentStep: state.currentStep,
      formData: deepClone(state.formData)
    };
  }

  function validateStep1() {
    if (!state.formData.categories.length) {
      return "Merci de sélectionner au moins une catégorie.";
    }
    if (state.formData.categories.length > 3) {
      return "Vous pouvez sélectionner jusqu’à 3 catégories maximum.";
    }
    return null;
  }

  function validateStep2() {
    if (!state.formData.title.trim()) {
      return "Merci de renseigner le titre de votre séjour.";
    }
    return null;
  }

  function validateStep3() {
    if (!state.formData.address || !state.formData.addressLat || !state.formData.addressLng) {
      return "Merci de choisir une adresse dans les propositions.";
    }
    return null;
  }

  function validateStep4() {
    if (!state.formData.dateType) {
      return "Merci de sélectionner quand le séjour a lieu.";
    }
    return null;
  }

  function validateStep5() {
    if (state.formData.dateType === "one_time") {
      if (!state.formData.oneTimeStart || !state.formData.oneTimeEnd) {
        return "Merci de renseigner les dates de début et de fin.";
      }
    }

    if (state.formData.dateType === "multiple_dates") {
      if (!state.formData.multipleDates.length) {
        return "Merci d’ajouter au moins une plage de dates.";
      }
    }

    if (state.formData.dateType === "period") {
      if (!state.formData.periodStart || !state.formData.periodEnd) {
        return "Merci de renseigner le début et la fin de la période.";
      }
    }

    if (state.formData.dateType === "recurring") {
      if (!state.formData.recurringFrequency) {
        return "Merci de sélectionner une fréquence.";
      }
      if (!state.formData.recurringDays.length) {
        return "Merci de sélectionner au moins un jour.";
      }
      if (!state.formData.recurringStart || !state.formData.recurringEnd) {
        return "Merci de renseigner le début et la fin de la récurrence.";
      }
    }

    return null;
  }

  function validateStep7() {
    if (!state.formData.description.trim()) {
      return "Merci de décrire votre séjour.";
    }
    if (!state.formData.experienceLevel.trim()) {
      return "Merci de sélectionner un niveau d’expérience.";
    }
    return null;
  }

  function validateStep8() {
    if (!state.formData.includedOptions.length) {
      return "Merci de sélectionner au moins un élément inclus.";
    }
    return null;
  }

  function validateStep10() {
    if (!state.formData.accommodations.length) {
      return "Ajoute au moins un logement avant de continuer.";
    }
    return null;
  }

  function validateStep13() {
    if (!state.formData.organizer.name.trim()) {
      return "Merci de renseigner le nom de l’organisateur.";
    }
    if (!state.formData.organizer.bio.trim()) {
      return "Merci de renseigner la bio de l’organisateur.";
    }
    return null;
  }

  function validateStep16() {
    if (!state.formData.cancellationPolicy) {
      return "Merci de sélectionner une politique d’annulation.";
    }
    return null;
  }

  function validateStep19() {
    if (!state.formData.travelLogistics.howToGetThere.trim()) {
      return "Merci de renseigner comment venir.";
    }
    return null;
  }
    function getStepValidator(step) {
    const validators = {
      1: validateStep1,
      2: validateStep2,
      3: validateStep3,
      4: validateStep4,
      5: validateStep5,
      7: validateStep7,
      8: validateStep8,
      10: validateStep10,
      13: validateStep13,
      16: validateStep16,
      19: validateStep19
    };

    return validators[step] || null;
  }

  function validateCurrentStep() {
    const validator = getStepValidator(state.currentStep);
    return validator ? validator() : null;
  }

  function registerStepAction(step, actionName, handler) {
    if (!state.stepActions[step]) state.stepActions[step] = {};
    state.stepActions[step][actionName] = handler;
  }

  async function runStepAction(step, actionName) {
    const handler = state.stepActions?.[step]?.[actionName];
    if (typeof handler === "function") {
      return await handler();
    }
  }

  function bindGlobalNavigation() {
  if (document.body.dataset.gkGlobalNavBound === "true") return;
  document.body.dataset.gkGlobalNavBound = "true";

  document.addEventListener("click", async (e) => {
    const backBtn = e.target.closest(".btn-back");
    if (backBtn) {
      e.preventDefault();
      e.stopPropagation();

      const handled = await runStepAction(state.currentStep, "back");
      if (handled === false) return;

      prevStep();
      return;
    }

    const nextBtn = e.target.closest(".btn-next");
    if (nextBtn) {
      e.preventDefault();
      e.stopPropagation();

      const handled = await runStepAction(state.currentStep, "next");

      if (handled === false) return;
      if (handled === true) return;

      const currentStepEl = getCurrentStepElement();
      const validationError = validateCurrentStep();

      if (validationError) {
        showError(currentStepEl, validationError);
        return;
      }

      nextStep();
      return;
    }

    const saveQuitBtn = e.target.closest(".btn-save-quit");
if (saveQuitBtn) {
  e.preventDefault();
  e.stopPropagation();

  try {
    console.log("SAVE QUIT CLICKED");
    state.isExplicitlySaving = true;
    state.formData.currentStep = state.currentStep;

    const effectiveListingId = getEffectiveListingId();

    if (!effectiveListingId) {
      throw new Error("Aucun listingId trouvé pour sauvegarder ce brouillon.");
    }

    persistListingId(effectiveListingId);

    await syncDraft();
    markClean();

    window.location.href = "/dashboard?tab=announcements";
  } catch (error) {
    console.error("SAVE & QUIT ERROR:", error);
    alert(error.message || "Erreur lors de l’enregistrement.");
  } finally {
    state.isExplicitlySaving = false;
  }

  return;
}

    const goStepBtn = e.target.closest(".btn-go-step");
    if (goStepBtn) {
      e.preventDefault();
      e.stopPropagation();

      const step = Number(goStepBtn.getAttribute("data-step"));
      if (!step) return;
      goToStep(step);
    }
  });
}

  function hydrateCommonUI() {
    showDateFieldsByType(state.formData.dateType);
    showProgramModeFields(state.formData.programMode);
  }

async function init() {
  loadStateFromStorage();

  const listingIdFromUrl = getQueryParam("id");
  const stepFromUrl = Number(getQueryParam("step"));

  if (listingIdFromUrl) {
    persistListingId(listingIdFromUrl);

    try {
      const listingData = await fetchOwnListing(listingIdFromUrl);
      hydrateStateFromListingResponse(listingData);
    } catch (error) {
      console.error("GK INIT LOAD ERROR:", error);
      persistListingId(listingIdFromUrl);
    }
  }

  bindGlobalNavigation();
  bindAutoClearErrors();
  bindBeforeUnloadProtection();
  hydrateCommonUI();

  const initialStep =
    !Number.isNaN(stepFromUrl) && stepFromUrl > 0
      ? stepFromUrl
      : Number(state.formData.currentStep || state.currentStep || 1) || 1;

  showStep(initialStep);

  emit("gk:ready");
}

  return {
    state,
    TOTAL_STEPS,
    DEFAULT_FORM_DATA,

    $,
    $$,
    emit,

    init,
    showStep,
    nextStep,
    prevStep,
    goToStep,
    getCurrentStepElement,

    saveStateToStorage,
    loadStateFromStorage,
    clearSavedDraftLocal,

    clearError,
    showError,
    validateCurrentStep,
    getStepValidator,

    registerStepAction,
    runStepAction,

    markDirty,
    markClean,

    uploadImageToCloudinary,

    createListingDraft,
    updateListingDraft,
    syncDraft,
    publishDraft,

    searchAddress,
    setAddressFromMapboxResult,
    resetAddressSelection,

    toggleCategory,
    setDateType,
    hideAllDateFields,
    showDateFieldsByType,
    toggleRecurringDay,

    toggleIncludedOption,
    addCustomIncludedOption,
    removeCustomIncludedOption,

    toggleAccommodationFacility,
    addCustomAccommodationFacility,
    removeCustomAccommodationFacility,
    resetAccommodationFormUI,
    fillAccommodationFormUI,
    getCurrentAccommodationImages,
    addAccommodationImage,
    removeAccommodationImage,
    saveCurrentAccommodation,
    deleteAccommodation,

    setProgramMode,
    hideProgramModeFields,
    showProgramModeFields,
    resetDailyProgramForm,
    saveDailyProgramItem,
    editDailyProgramItem,
    deleteDailyProgramItem,
    resetProgramDayForm,
    saveProgramDay,
    editProgramDay,
    deleteProgramDay,
    addProgramActivity,
    deleteProgramActivity,

    addListingImage,
    removeListingImage,

    updateOrganizer,

    resetAddonForm,
    saveAddon,
    editAddon,
    deleteAddon,

    setCancellationPolicy,

    setMealsIncluded,
    setDrinksIncluded,
    toggleMealType,
    toggleDietOption,
    addCustomDietOption,
    removeCustomDietOption,

    updateLocationDetails,
    toggleLocationFacility,
    addCustomLocationFacility,
    removeCustomLocationFacility,

    updateTravelLogistics,
    updateBusinessSettings,

    getReviewData
  };
})();

function forceDisplayStep(step) {
  const safeStep = Number(step);
  if (!safeStep || safeStep < 1) return;

  for (let i = 1; i <= 21; i += 1) {
    document.querySelectorAll(`.step-${i}`).forEach(el => {
      el.style.display = "none";
    });
  }

  document.querySelectorAll(`.step-${safeStep}`).forEach(el => {
    el.style.display = "block";
  });

  if (window.GKFormApp) {
    window.GKFormApp.state.currentStep = safeStep;
    window.GKFormApp.state.formData.currentStep = safeStep;
  }

  console.log("FORCE DISPLAY STEP:", safeStep);
}

function forceDisplayStep(step) {
  const safeStep = Number(step);
  if (!safeStep || safeStep < 1) return;

  for (let i = 1; i <= 21; i += 1) {
    document.querySelectorAll(`.step-${i}`).forEach(el => {
      el.style.display = "none";
    });
  }

  document.querySelectorAll(`.step-${safeStep}`).forEach(el => {
    el.style.display = "block";
  });

  if (window.GKFormApp) {
    window.GKFormApp.state.currentStep = safeStep;
    window.GKFormApp.state.formData.currentStep = safeStep;
  }

  console.log("FORCE DISPLAY STEP:", safeStep);
}

function forceRestoreDraftContext() {
  if (!window.GKFormApp) return;

  const params = new URLSearchParams(window.location.search);
  const forcedId = params.get("id");
  const forcedStep = Number(params.get("step"));

  if (forcedId) {
    window.GKFormApp.state.listingId = forcedId;
  }

  if (!Number.isNaN(forcedStep) && forcedStep > 0) {
    window.GKFormApp.state.currentStep = forcedStep;
    window.GKFormApp.state.formData.currentStep = forcedStep;
    forceDisplayStep(forcedStep);
  }

  console.log("RESTORED ID:", window.GKFormApp.state.listingId);
  console.log("RESTORED STEP:", window.GKFormApp.state.currentStep);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.GKFormApp) return;

  await window.GKFormApp.init();

  setTimeout(forceRestoreDraftContext, 50);
  setTimeout(forceRestoreDraftContext, 300);
  setTimeout(forceRestoreDraftContext, 900);
});

window.addEventListener("load", () => {
  setTimeout(forceRestoreDraftContext, 100);
});
