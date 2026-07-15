import {
  render,
  showToast,
  state,
  updateCarouselRecipes,
  saveSelectedIngredients,
} from "./app.js";
import { INGREDIENTS, registerIngredient } from "./data.js";
import { analyzeReceipt } from "./supabase.js";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;
const MAX_ANALYZED_ITEMS = 50;

const ingredientAliases = new Map([
  ["달걀", "계란"],
  ["특란", "계란"],
  ["계란한판", "계란"],
  ["깐대파", "대파"],
  ["파한단", "대파"],
  ["알감자", "감자"],
  ["햇감자", "감자"],
  ["양배추한통", "양배추"],
  ["돼지앞다리", "돼지고기"],
  ["돼지목살", "돼지고기"],
  ["소불고기", "소고기"],
  ["햇반", "밥"],
  ["즉석밥", "밥"],
]);

const receiptState = {
  stage: "empty",
  file: null,
  previewUrl: "",
  items: [],
  errorMessage: "",
  isDemo: false,
};

let isInitialized = false;
let focusReturnTarget = null;
let analysisRunId = 0;
let analysisController = null;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampText(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

const ingredientAliasIndex = [...ingredientAliases.entries()].sort(
  ([aliasA], [aliasB]) => aliasB.length - aliasA.length,
);

function findMatchingIngredient(...names) {
  let customIngredients = [];
  try {
    const saved = JSON.parse(localStorage.getItem("customIngredients") || "[]");
    customIngredients = Array.isArray(saved) ? saved : [];
  } catch {
    customIngredients = [];
  }
  const ingredientIndex = [...INGREDIENTS, ...customIngredients]
    .filter((ingredient, index, all) => all.findIndex((item) => item.id === ingredient.id) === index)
    .map((ingredient) => ({
      ...ingredient,
      normalizedName: normalizeText(ingredient.name),
    }))
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length);

  for (const name of names) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) continue;

    const aliasName = ingredientAliasIndex.find(([alias]) =>
      normalizedName.includes(alias),
    )?.[1];
    const normalizedAlias = normalizeText(aliasName);
    const candidates = normalizedAlias
      ? [normalizedAlias, normalizedName]
      : [normalizedName];

    for (const candidate of candidates) {
      const exactMatch = ingredientIndex.find(
        (ingredient) => ingredient.normalizedName === candidate,
      );
      if (exactMatch) return exactMatch;

      // 상품명에 재료명이 포함됐다는 이유만으로 매칭하지 않습니다.
      // 예: 양파즙/감자칩처럼 다른 상품을 원재료로 오인하는 것을 방지합니다.
    }
  }

  return null;
}

function revokePreviewUrl() {
  if (!receiptState.previewUrl) return;
  URL.revokeObjectURL(receiptState.previewUrl);
  receiptState.previewUrl = "";
}

function resetReceiptState() {
  analysisRunId += 1;
  analysisController?.abort();
  analysisController = null;
  revokePreviewUrl();
  receiptState.stage = "empty";
  receiptState.file = null;
  receiptState.items = [];
  receiptState.errorMessage = "";
  receiptState.isDemo = false;
}

function ensureReceiptModal() {
  let modal = document.getElementById("receipt-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "receipt-modal";
  modal.className = "custom-modal-overlay receipt-modal-overlay";
  modal.setAttribute("aria-hidden", "true");
  document.body.appendChild(modal);
  return modal;
}

function formatFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function renderProgress() {
  const stageOrder = { empty: 1, ready: 1, analyzing: 2, results: 3, error: 2 };
  const currentStep = stageOrder[receiptState.stage] || 1;
  const steps = ["업로드", "AI 분석", "냉장고 추가"];

  return `
    <ol class="receipt-progress" aria-label="영수증 등록 진행 상태">
      ${steps
        .map(
          (label, index) => `
            <li class="${index + 1 <= currentStep ? "active" : ""}" ${index + 1 === currentStep ? 'aria-current="step"' : ""}>
              <span>${index + 1}</span>${label}
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function renderUploadBody() {
  return `
    <div class="receipt-drop-zone" id="receipt-drop-zone" tabindex="0" role="button" aria-label="영수증 이미지 선택">
      <span class="receipt-drop-icon" aria-hidden="true">📷</span>
      <strong>영수증 사진을 올려주세요</strong>
      <p>글자가 선명하게 보이는 사진일수록 재료를 더 잘 찾을 수 있어요.</p>
      <button type="button" class="btn btn-secondary" id="btn-receipt-choose">사진 선택</button>
      <small>JPG, PNG, WEBP · 최대 10MB</small>
    </div>
  `;
}

function renderPreviewBody({ analyzing = false } = {}) {
  const fileName = escapeHtml(receiptState.file?.name || "영수증 이미지");
  const previewUrl = escapeHtml(receiptState.previewUrl);

  return `
    <div class="receipt-preview-layout ${analyzing ? "is-analyzing" : ""}">
      <div class="receipt-preview-frame">
        <img src="${previewUrl}" alt="업로드한 영수증 미리보기" />
        ${
          analyzing
            ? '<div class="receipt-preview-loading"><span class="receipt-spinner" aria-hidden="true"></span></div>'
            : ""
        }
      </div>
      <div class="receipt-file-info">
        <strong title="${fileName}">${fileName}</strong>
        <span>${formatFileSize(receiptState.file?.size || 0)}</span>
      </div>
    </div>
    ${
      analyzing
        ? `
          <div class="receipt-analyzing-copy" role="status" aria-live="polite">
            <strong>영수증에서 장본 재료를 찾고 있어요</strong>
            <p>상품명과 수량을 읽고 냉장고 재료와 연결하는 중입니다.</p>
          </div>
        `
        : `
          <div class="receipt-modal-actions">
            <button type="button" class="btn btn-outline" id="btn-receipt-reselect">다른 사진</button>
            <button type="button" class="btn btn-primary" id="btn-receipt-analyze">영수증 분석하기</button>
          </div>
        `
    }
  `;
}

function renderErrorBody() {
  return `
    <div class="receipt-error-box" role="alert">
      <span aria-hidden="true">😵</span>
      <strong>영수증을 분석하지 못했어요</strong>
      <p>${escapeHtml(receiptState.errorMessage)}</p>
    </div>
    <div class="receipt-modal-actions">
      <button type="button" class="btn btn-outline" id="btn-receipt-reselect">다른 사진</button>
      <button type="button" class="btn btn-primary" id="btn-receipt-analyze">다시 분석하기</button>
    </div>
  `;
}

function renderResultItem(item) {
  const ingredient = item.ingredientId
    ? INGREDIENTS.find((candidate) => candidate.id === item.ingredientId)
    : null;
  const isAlreadyAdded = Boolean(
    item.ingredientId && state.selected.has(item.ingredientId),
  );
  const statusText = ingredient
    ? isAlreadyAdded
      ? "이미 냉장고에 있음"
      : `${ingredient.name}(으)로 인식`
    : "등록되지 않은 재료";
  const itemClass = ingredient ? "matched" : "unmatched";

  return `
    <label class="receipt-result-item ${itemClass}">
      <input
        type="checkbox"
        data-receipt-item-id="${escapeHtml(item.id)}"
        ${item.selected ? "checked" : ""}
        ${ingredient ? "" : "disabled"}
      />
      <span class="receipt-result-emoji" aria-hidden="true">${ingredient?.emoji || "❓"}</span>
      <span class="receipt-result-copy">
        <strong>${escapeHtml(item.rawName)}</strong>
        <small>${escapeHtml(statusText)}</small>
      </span>
      ${item.quantity ? `<span class="receipt-quantity">${escapeHtml(item.quantity)}</span>` : ""}
    </label>
  `;
}

function renderResultsBody() {
  const matchedCount = receiptState.items.filter((item) => item.ingredientId).length;
  const unmatchedCount = receiptState.items.length - matchedCount;
  const selectedCount = receiptState.items.filter(
    (item) => item.selected && item.ingredientId,
  ).length;

  return `
    ${
      receiptState.isDemo
        ? `
          <div class="receipt-demo-notice" role="note">
            <strong>API 연결 전 데모 분석 결과입니다.</strong>
            <span>실제 AI 연결 후에는 업로드한 영수증의 품목이 표시됩니다.</span>
          </div>
        `
        : ""
    }
    <div class="receipt-result-summary" aria-live="polite">
      <strong>${matchedCount}개 재료를 찾았어요!</strong>
      <span>${unmatchedCount ? `미등록 품목 ${unmatchedCount}개는 제외됩니다.` : "모든 품목을 냉장고 재료와 연결했어요."}</span>
    </div>
    <div class="receipt-result-list">
      ${receiptState.items.map(renderResultItem).join("")}
    </div>
    <div class="receipt-modal-actions receipt-result-actions">
      <button type="button" class="btn btn-outline" id="btn-receipt-reselect">다시 업로드</button>
      <button type="button" class="btn btn-primary" id="btn-receipt-add" ${selectedCount === 0 ? "disabled" : ""}>
        선택한 ${selectedCount}개 추가
      </button>
    </div>
  `;
}

function renderReceiptModal() {
  const modal = ensureReceiptModal();
  let body = renderUploadBody();

  if (receiptState.stage === "ready") body = renderPreviewBody();
  if (receiptState.stage === "analyzing") {
    body = renderPreviewBody({ analyzing: true });
  }
  if (receiptState.stage === "results") body = renderResultsBody();
  if (receiptState.stage === "error") body = renderErrorBody();

  modal.innerHTML = `
    <section class="custom-modal-content receipt-modal-content" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
      <button type="button" class="modal-close" id="btn-receipt-close" aria-label="영수증 등록 창 닫기">✕</button>
      <div class="receipt-modal-heading">
        <span class="receipt-modal-emoji" aria-hidden="true">🧾</span>
        <div>
          <h3 id="receipt-modal-title">영수증으로 냉장고 채우기</h3>
          <p>장봐 온 재료를 사진 한 장으로 정리해 보세요.</p>
        </div>
      </div>
      ${renderProgress()}
      <input class="visually-hidden" type="file" id="receipt-file-input" accept="image/jpeg,image/png,image/webp" />
      <div class="receipt-modal-body">${body}</div>
    </section>
  `;
}

function openReceiptModal(trigger) {
  focusReturnTarget = trigger || document.activeElement;
  resetReceiptState();
  renderReceiptModal();
  const modal = ensureReceiptModal();
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => modal.querySelector("#btn-receipt-choose")?.focus());
}

function closeReceiptModal() {
  const modal = ensureReceiptModal();
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  resetReceiptState();
  focusReturnTarget?.focus?.();
  focusReturnTarget = null;
}

function validateReceiptFile(file) {
  if (!file) return "영수증 사진을 선택해 주세요.";
  if (file.size === 0) return "내용이 없는 파일은 업로드할 수 없어요.";
  if (file.size > MAX_RECEIPT_SIZE) return "10MB 이하의 영수증 사진을 선택해 주세요.";
  if (
    !ALLOWED_IMAGE_TYPES.has(file.type) &&
    !ALLOWED_IMAGE_EXTENSION.test(file.name)
  ) {
    return "JPG, PNG 또는 WEBP 이미지 파일만 업로드할 수 있어요.";
  }
  return "";
}

function selectReceiptFile(file) {
  const validationError = validateReceiptFile(file);
  if (validationError) {
    showToast(validationError);
    return;
  }

  analysisRunId += 1;
  analysisController?.abort();
  revokePreviewUrl();
  receiptState.file = file;
  receiptState.previewUrl = URL.createObjectURL(file);
  receiptState.items = [];
  receiptState.errorMessage = "";
  receiptState.isDemo = false;
  receiptState.stage = "ready";
  renderReceiptModal();
}

function createDemoAnalysisItems() {
  const preferredNames = ["계란", "대파", "감자", "양배추", "돼지고기"];
  const preferredIngredients = preferredNames
    .map((name) => INGREDIENTS.find((ingredient) => ingredient.name === name))
    .filter(Boolean);
  const fallbackIngredients = INGREDIENTS.filter(
    (ingredient) =>
      !preferredIngredients.some((preferred) => preferred.id === ingredient.id),
  );
  const ingredients = [...preferredIngredients, ...fallbackIngredients].slice(0, 5);

  return ingredients.map((ingredient, index) => ({
    rawName: index % 2 === 0 ? `신선 ${ingredient.name}` : ingredient.name,
    normalizedName: ingredient.name,
    quantity: index === 0 ? "1팩" : "1개",
  }));
}

function waitForDemo(signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 900);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("영수증 분석이 취소되었습니다.", "AbortError"));
      },
      { once: true },
    );
  });
}

async function requestReceiptAnalysis(file, signal) {
  if (signal.aborted) {
    throw new DOMException("영수증 분석이 취소되었습니다.", "AbortError");
  }

  // Supabase Edge Function(analyze-receipt)으로 실제 영수증 이미지를 전송합니다.
  const result = await analyzeReceipt(file);
  if (!Array.isArray(result?.items) || result.items.length === 0) {
    throw new Error("Supabase 영수증 분석 결과가 비어 있습니다.");
  }

  return { items: result.items, isDemo: false };
}

function normalizeAnalysisItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("분석 결과의 형식이 올바르지 않습니다.");
  }

  const normalizedItems = [];
  const usedKeys = new Set();

  items.slice(0, MAX_ANALYZED_ITEMS).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const rawName = clampText(item.rawName || item.name || item.productName);
    const normalizedName = clampText(item.normalizedName || item.ingredientName);
    if (!rawName && !normalizedName) return;

    let ingredient = findMatchingIngredient(normalizedName, rawName);
    if (!ingredient && normalizedName) {
      ingredient = registerIngredient(normalizedName);
    }
    const dedupeKey = ingredient?.id || normalizeText(normalizedName || rawName);
    if (!dedupeKey || usedKeys.has(dedupeKey)) return;
    usedKeys.add(dedupeKey);

    normalizedItems.push({
      id: `receipt-item-${index}`,
      rawName: rawName || normalizedName,
      quantity: clampText(item.quantity, 20),
      ingredientId: ingredient?.id || null,
      selected: Boolean(ingredient),
    });
  });

  if (normalizedItems.length === 0) {
    throw new Error("영수증에서 추가할 수 있는 품목을 찾지 못했어요.");
  }

  return normalizedItems;
}

async function analyzeSelectedReceipt() {
  if (!receiptState.file || receiptState.stage === "analyzing") return;

  const runId = ++analysisRunId;
  analysisController?.abort();
  analysisController = new AbortController();
  receiptState.stage = "analyzing";
  receiptState.errorMessage = "";
  renderReceiptModal();

  try {
    const result = await requestReceiptAnalysis(
      receiptState.file,
      analysisController.signal,
    );
    if (runId !== analysisRunId) return;
    receiptState.items = normalizeAnalysisItems(result.items);
    receiptState.isDemo = Boolean(result.isDemo);
    receiptState.stage = "results";
  } catch (error) {
    if (error?.name === "AbortError" || runId !== analysisRunId) return;
    console.error("영수증 분석 실패:", error);
    receiptState.errorMessage =
      error instanceof Error
        ? error.message
        : "잠시 후 다시 시도해 주세요.";
    receiptState.stage = "error";
  } finally {
    if (runId === analysisRunId) analysisController = null;
    if (runId === analysisRunId) renderReceiptModal();
  }
}

function updateResultSelection(input) {
  const item = receiptState.items.find(
    (candidate) => candidate.id === input.dataset.receiptItemId,
  );
  if (!item || !item.ingredientId) return;
  item.selected = input.checked;
  renderReceiptModal();
  ensureReceiptModal()
    .querySelector(`[data-receipt-item-id="${item.id}"]`)
    ?.focus();
}

function addSelectedIngredients() {
  const ingredientIds = [
    ...new Set(
      receiptState.items
        .filter((item) => item.selected && item.ingredientId)
        .map((item) => item.ingredientId),
    ),
  ];
  if (ingredientIds.length === 0) return;

  let addedCount = 0;
  ingredientIds.forEach((ingredientId) => {
    if (!state.selected.has(ingredientId)) addedCount += 1;
    state.selected.add(ingredientId);
  });
  saveSelectedIngredients();

  state.search = "";
  state.activeCategory = "all";
  state.isFridgeOpen = true;
  updateCarouselRecipes();
  closeReceiptModal();
  render();

  document.dispatchEvent(
    new CustomEvent("fridge:ingredients-added", {
      detail: { ingredientIds, source: "receipt" },
    }),
  );
  showToast(
    addedCount > 0
      ? `영수증 재료 ${addedCount}개를 냉장고에 추가했어요.`
      : "선택한 재료가 이미 냉장고에 있어요.",
  );
}

function chooseReceiptFile() {
  const input = ensureReceiptModal().querySelector("#receipt-file-input");
  if (!input) return;
  input.value = "";
  input.click();
}

function handleClick(event) {
  const uploadButton = event.target.closest("#btn-receipt-upload");
  if (uploadButton) {
    openReceiptModal(uploadButton);
    return;
  }

  const modal = event.target.closest("#receipt-modal");
  if (!modal) return;

  if (
    event.target === modal ||
    event.target.closest("#btn-receipt-close")
  ) {
    closeReceiptModal();
    return;
  }

  if (
    event.target.closest("#btn-receipt-choose") ||
    event.target.closest("#btn-receipt-reselect")
  ) {
    chooseReceiptFile();
    return;
  }

  if (event.target.closest("#receipt-drop-zone")) {
    chooseReceiptFile();
    return;
  }

  if (event.target.closest("#btn-receipt-analyze")) {
    analyzeSelectedReceipt();
    return;
  }

  if (event.target.closest("#btn-receipt-add")) {
    addSelectedIngredients();
  }
}

function handleChange(event) {
  if (event.target.matches("#receipt-file-input")) {
    selectReceiptFile(event.target.files?.[0]);
    return;
  }

  if (event.target.matches("[data-receipt-item-id]")) {
    updateResultSelection(event.target);
  }
}

function handleKeydown(event) {
  const modal = document.getElementById("receipt-modal");
  if (!modal?.classList.contains("show")) return;

  if (event.key === "Escape") {
    closeReceiptModal();
    return;
  }

  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("#receipt-drop-zone")
  ) {
    event.preventDefault();
    chooseReceiptFile();
  }
}

function handleDragOver(event) {
  const dropZone = event.target.closest("#receipt-drop-zone");
  if (!dropZone) return;
  event.preventDefault();
  if (event.type === "dragover") dropZone.classList.add("is-dragging");
  if (event.type === "dragleave") dropZone.classList.remove("is-dragging");
}

function handleDrop(event) {
  const dropZone = event.target.closest("#receipt-drop-zone");
  if (!dropZone) return;
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  selectReceiptFile(event.dataTransfer?.files?.[0]);
}

export function initReceipt() {
  if (isInitialized) return;
  isInitialized = true;
  ensureReceiptModal();
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragOver);
  document.addEventListener("drop", handleDrop);
}
