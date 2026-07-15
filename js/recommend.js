//------------------------------------
// 담당 : 지호
// 수정 가능
//------------------------------------
/* 추천 기능 모듈 */

import { state, showToast, render, navigate, updateCarouselRecipes, saveSelectedIngredients } from './app.js';
import { RECIPES, ALTERNATIVE_RECIPES, INGREDIENTS } from './data.js';

// 추천 화면에서만 사용하는 취향 상태입니다. app.js의 state 구조는 변경하지 않습니다.
const selectedPreferences = new Set();
const selectedCuisines = new Set();
let recipeSearchQuery = '';
let recipePage = 1;
let isSearchComposing = false;
let searchRefreshTimer = null;
let activeDifficultyFilter = 'all';
const RECEIPT_MEMORY_KEY = 'bigdataCamp.receiptMemory.v1';
const RECEIPT_ANALYSIS_MEMORY_KEY = 'bigdataCamp.receiptAnalyses.v1';
const RECEIPT_IMAGE_DB_NAME = 'bigdataCamp.receiptImages.v1';
const RECEIPT_IMAGE_STORE = 'receipts';
let receiptAttachedAt = null;
let receiptMemoryObserver = null;
let receiptImageDbPromise = null;
let receiptImageObjectUrls = [];
let suppressNextReceiptImageSave = false;
let activeReceiptImageId = null;

export function getActiveReceiptImageId() {
  return activeReceiptImageId;
}

const ingredientShelfLifeDays = [
  { pattern: /생선|회|새우|조개|해산물/, days: 2 },
  { pattern: /돼지고기|소고기|닭고기|고기|불고기|햄|소시지/, days: 3 },
  { pattern: /두부|우유|계란|치즈|요거트|유제품/, days: 7 },
  { pattern: /김치|장아찌|피클/, days: 30 },
  { pattern: /대파|양파|감자|당근|양배추|애호박|채소|과일/, days: 7 },
  { pattern: /밥|식빵|빵|국수|우동|파스타|면/, days: 5 }
];

function readReceiptMemory() {
  try {
    const analyses = JSON.parse(localStorage.getItem(RECEIPT_ANALYSIS_MEMORY_KEY) || '[]');
    if (Array.isArray(analyses) && analyses.length) {
      return analyses
        .filter((analysis) => Array.isArray(analysis.items) && analysis.items.length)
        .sort(compareReceiptAnalyses)[0] || { items: [] };
    }
    const value = JSON.parse(localStorage.getItem(RECEIPT_MEMORY_KEY) || 'null');
    return value && Array.isArray(value.items) ? value : { items: [] };
  } catch {
    return { items: [] };
  }
}

function getReceiptAnalysisTime(analysis) {
  const time = new Date(analysis?.purchaseDate || analysis?.attachedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareReceiptAnalyses(left, right) {
  return getReceiptAnalysisTime(right) - getReceiptAnalysisTime(left)
    || new Date(right?.attachedAt || 0).getTime() - new Date(left?.attachedAt || 0).getTime();
}

function readReceiptAnalyses() {
  try {
    const value = JSON.parse(localStorage.getItem(RECEIPT_ANALYSIS_MEMORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeReceiptAnalyses(analyses) {
  try { localStorage.setItem(RECEIPT_ANALYSIS_MEMORY_KEY, JSON.stringify(analyses)); } catch { /* 저장소가 없는 환경은 일회성 동작 */ }
}

function saveReceiptAnalysis(analysis) {
  const analyses = readReceiptAnalyses().filter((item) => item.imageId !== analysis.imageId);
  analyses.push(analysis);
  writeReceiptAnalyses(analyses);
}

function deleteReceiptAnalysisForImage(imageId) {
  if (!imageId) return;
  const analyses = readReceiptAnalyses().filter((analysis) => analysis.imageId !== imageId);
  writeReceiptAnalyses(analyses);
  const latest = analyses
    .filter((analysis) => Array.isArray(analysis.items) && analysis.items.length)
    .sort(compareReceiptAnalyses)[0];
  writeReceiptMemory(latest || { items: [] });
  refreshReceiptInsights();
}

function deleteReceiptAnalysisItem(itemId) {
  const storedAnalyses = readReceiptAnalyses();
  let deletedItemName = '';

  const findItemName = (items) => {
    const found = items.find((item) => (item.id || item.name) === itemId);
    return found ? found.name : '';
  };

  if (!storedAnalyses.length) {
    const legacyMemory = readReceiptMemory();
    deletedItemName = findItemName(legacyMemory.items);
    legacyMemory.items = legacyMemory.items.filter((item) => (item.id || item.name) !== itemId);
    writeReceiptMemory(legacyMemory);
  } else {
    for (const analysis of storedAnalyses) {
      const name = findItemName(analysis.items);
      if (name) {
        deletedItemName = name;
        break;
      }
    }
    const analyses = storedAnalyses.map((analysis) => ({
      ...analysis,
      items: analysis.items.filter((item) => (item.id || item.name) !== itemId),
    })).filter((analysis) => analysis.items.length);
    writeReceiptAnalyses(analyses);
    const latest = analyses.sort(compareReceiptAnalyses)[0];
    if (latest) writeReceiptMemory(latest);
    else writeReceiptMemory({ items: [] });
  }

  if (deletedItemName) {
    const norm = normalizeReceiptMatchText(deletedItemName);
    if (norm) {
      const matched = INGREDIENTS.find((ingredient) => {
        const ingNorm = normalizeReceiptMatchText(ingredient.name);
        return norm.includes(ingNorm) || ingNorm.includes(norm);
      });
      if (matched && state.selected.has(matched.id)) {
        state.selected.delete(matched.id);
        saveSelectedIngredients();
        updateCarouselRecipes();
      }
    }
  }

  refreshReceiptInsights();
}

function refreshReceiptInsights() {
  document.querySelectorAll('[data-receipt-insight]').forEach((section) => section.remove());
  decorateDetailPage();
}

function writeReceiptMemory(memory) {
  try { localStorage.setItem(RECEIPT_MEMORY_KEY, JSON.stringify(memory)); } catch { /* 저장소가 없는 환경은 일회성 동작 */ }
}

function openReceiptImageDb() {
  if (receiptImageDbPromise) return receiptImageDbPromise;
  receiptImageDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not supported'));
    const request = indexedDB.open(RECEIPT_IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(RECEIPT_IMAGE_STORE)) {
        request.result.createObjectStore(RECEIPT_IMAGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return receiptImageDbPromise;
}

function withReceiptImageStore(mode, callback) {
  return openReceiptImageDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(RECEIPT_IMAGE_STORE, mode);
    const request = callback(transaction.objectStore(RECEIPT_IMAGE_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function listStoredReceiptImages() {
  return withReceiptImageStore('readonly', (store) => store.getAll())
    .then((items) => items.sort((a, b) => b.createdAt - a.createdAt))
    .catch(() => []);
}

function saveReceiptImage(file) {
  const record = {
    id: `receipt-image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name || '영수증 이미지',
    type: file.type || 'image/jpeg',
    size: file.size || 0,
    blob: file,
    createdAt: Date.now(),
  };
  activeReceiptImageId = record.id;
  return withReceiptImageStore('readwrite', (store) => store.add(record))
    .then(() => record)
    .catch(() => null);
}

function deleteStoredReceiptImage(id) {
  return withReceiptImageStore('readwrite', (store) => store.delete(id)).catch(() => null);
}

function clearStoredReceiptImages() {
  return withReceiptImageStore('readwrite', (store) => store.clear()).catch(() => null);
}

function renderReceiptImageHistory(items) {
  receiptImageObjectUrls = [];
  if (!items.length) return '<li class="receipt-history-empty">기억하고 있는 영수증이 없습니다.</li>';
  return items.map((item) => {
    const url = URL.createObjectURL(item.blob);
    receiptImageObjectUrls.push(url);
    const date = new Date(item.createdAt);
    const dateText = Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    return `<li class="receipt-history-item">
      <button type="button" data-receipt-history-select="${escapeHtml(item.id)}" title="${escapeHtml(item.name)}" class="receipt-history-preview">
        <img src="${url}" alt="" />
        <span>${escapeHtml(item.name)}<small style="display:block; opacity:.65;">${dateText}</small></span>
      </button>
      <button type="button" class="receipt-history-delete" data-receipt-history-delete="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} 삭제" title="삭제">×</button>
    </li>`;
  }).join('');
}

function ensureReceiptHistoryPanel() {
  const modal = document.querySelector('#receipt-modal.show');
  const content = modal?.querySelector('.receipt-modal-content');
  if (!content || content.querySelector('[data-receipt-history-panel]')) return;
  const panel = document.createElement('div');
  panel.dataset.receiptHistoryPanel = 'true';
  panel.className = 'receipt-history-bar';
  panel.innerHTML = '<button type="button" class="btn btn-outline receipt-history-open" data-receipt-history-open aria-label="첨부된 영수증 목록 크게 보기">첨부된 영수증 목록</button>';
  content.insertBefore(panel, content.querySelector('.receipt-modal-heading'));
}

function closeReceiptLibrary() {
  document.querySelector('[data-receipt-history-library]')?.remove();
  receiptImageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  receiptImageObjectUrls = [];
}

function renderReceiptLibrary(items, selectedId) {
  const overlay = document.querySelector('[data-receipt-history-library]');
  if (!overlay) return;
  receiptImageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  receiptImageObjectUrls = [];
  const selected = items.find((item) => item.id === selectedId) || items[0];
  const selectedUrl = selected ? URL.createObjectURL(selected.blob) : '';
  if (selectedUrl) receiptImageObjectUrls.push(selectedUrl);
  const itemList = items.length
    ? items.map((item) => {
      const url = URL.createObjectURL(item.blob);
      receiptImageObjectUrls.push(url);
      return `<li class="receipt-history-item ${item.id === selected?.id ? 'active' : ''}">
        <button type="button" data-receipt-history-preview="${escapeHtml(item.id)}" class="receipt-history-preview">
          <img src="${url}" alt="" />
          <span>${escapeHtml(item.name)}</span>
        </button>
        <button type="button" class="receipt-history-delete" data-receipt-history-delete="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} 삭제">×</button>
      </li>`;
    }).join('')
    : '<li class="receipt-history-empty">기억하고 있는 영수증이 없습니다.</li>';
  overlay.innerHTML = `<section class="custom-modal-content receipt-history-content" role="dialog" aria-modal="true" aria-labelledby="receipt-history-title">
    <header class="receipt-history-header">
      <div>
        <h3 id="receipt-history-title">첨부된 영수증 목록</h3>
        <p>저장된 영수증을 크게 확인하고 선택할 수 있어요.</p>
      </div>
      <div class="receipt-history-header-actions">
        <button type="button" class="btn btn-outline" data-receipt-history-clear aria-label="저장된 영수증 전체 삭제">전체 삭제</button>
        <button type="button" class="modal-close" data-receipt-history-close aria-label="영수증 목록 닫기">×</button>
      </div>
    </header>
    <div class="receipt-history-layout">
      <ul class="receipt-history-list">${itemList}</ul>
      <div class="receipt-history-viewer">
        ${selected ? `<img src="${selectedUrl}" alt="${escapeHtml(selected.name)} 크게 보기" /><strong>${escapeHtml(selected.name)}</strong><button type="button" class="btn btn-primary" data-receipt-history-select="${escapeHtml(selected.id)}">이 영수증 사용</button>` : '<p style="color:#777;">확인할 영수증을 선택해 주세요.</p>'}
      </div>
    </div>
  </section>`;
}

function openReceiptLibrary() {
  closeReceiptLibrary();
  const overlay = document.createElement('div');
  overlay.dataset.receiptHistoryLibrary = 'true';
  overlay.className = 'custom-modal-overlay receipt-history-overlay show';
  document.body.appendChild(overlay);
  listStoredReceiptImages().then((items) => renderReceiptLibrary(items));
}

function selectStoredReceiptImage(id) {
  listStoredReceiptImages().then((items) => {
    const record = items.find((item) => item.id === id);
    const input = document.querySelector('#receipt-modal.show #receipt-file-input');
    if (!record || !input) return;
    activeReceiptImageId = record.id;
    const transfer = new DataTransfer();
    transfer.items.add(new File([record.blob], record.name, { type: record.type || 'image/jpeg' }));
    input.files = transfer.files;
    suppressNextReceiptImageSave = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeReceiptLibrary();
  });
}

function refreshReceiptHistoryPanel() {
  const panel = document.querySelector('#receipt-modal.show [data-receipt-history-panel]');
  const list = panel?.querySelector('[data-receipt-history-list]');
  if (!panel || !list) return;
  listStoredReceiptImages().then((items) => {
    if (panel.isConnected) list.innerHTML = renderReceiptImageHistory(items);
  });
}

function captureReceiptResult() {
  const modal = document.querySelector('#receipt-modal');
  const rows = [...(modal?.querySelectorAll('.receipt-result-item') || [])];
  if (!rows.length) return;

  const previous = readReceiptMemory();
  const capturedAt = receiptAttachedAt || new Date().toISOString();
  const imageId = activeReceiptImageId || `receipt-session-${capturedAt}`;
  const items = rows.map((row) => {
    const text = row.textContent.replace(/\s+/g, ' ').trim();
    const name = row.querySelector('.receipt-result-copy strong')?.textContent.trim() || text;
    const quantity = row.querySelector('.receipt-quantity')?.textContent.trim() || '';
    const sourceId = row.querySelector('[data-receipt-item-id]')?.getAttribute('data-receipt-item-id') || name;
    const id = `${imageId}-${sourceId}`;
    return { id, name, quantity, capturedAt };
  }).filter((item) => item.name);

  const purchaseDate = modal.querySelector('[data-receipt-date]')?.getAttribute('data-receipt-date')
    || modal.querySelector('.receipt-date')?.textContent.match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/)?.[0]
    || null;
  const analysis = {
    imageId,
    attachedAt: capturedAt,
    purchaseDate,
    items,
  };
  saveReceiptAnalysis(analysis);
  writeReceiptMemory(analysis);
}

function startReceiptMemoryObserver() {
  const receiptModal = document.querySelector('#receipt-modal');
  if (receiptMemoryObserver || !receiptModal) return;
  receiptMemoryObserver = new MutationObserver(() => {
    captureReceiptResult();
    queueMicrotask(ensureReceiptHistoryPanel);
  });
  // 영수증 모달 내부만 감시합니다. 문서 전체를 감시하면 냉장고 렌더링과 클릭 이벤트에 불필요한 부하를 줍니다.
  receiptMemoryObserver.observe(receiptModal, { childList: true, subtree: true });
}

function getReceiptDate(memory) {
  const source = memory.purchaseDate || memory.attachedAt;
  const date = source ? new Date(source) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatShortDate(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function getIngredientShelfLifeDays(name) {
  return ingredientShelfLifeDays.find(({ pattern }) => pattern.test(name))?.days || 7;
}

function normalizeReceiptMatchText(value) {
  return String(value || '')
    .replace(/[\d().,/~%g·]/g, ' ')
    .replace(/(개|팩|봉|병|캔|장|인분|그램|g|ml|kg|L|약간|작은술|큰술)/gi, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function getRecipeIngredientNames(recipe) {
  const names = [
    ...(recipe.ingredients || []),
    ...(recipe.need || []).map((id) => INGREDIENTS.find((ingredient) => ingredient.id === id)?.name)
  ];
  return [...new Set(names.map(normalizeReceiptMatchText).filter((name) => name.length >= 2))];
}

function filterReceiptItemsForRecipe(recipe, memory) {
  const recipeIngredientNames = getRecipeIngredientNames(recipe);
  return memory.items.filter((item) => {
    const receiptName = normalizeReceiptMatchText(item.name);
    return recipeIngredientNames.some((ingredientName) =>
      receiptName.includes(ingredientName) || ingredientName.includes(receiptName),
    );
  });
}

function getIngredientExpiryLabel(item, memory) {
  const baseDate = getReceiptDate(memory);
  const expiryDate = new Date(baseDate);
  expiryDate.setDate(expiryDate.getDate() + getIngredientShelfLifeDays(item.name));
  const isExpired = expiryDate.getTime() < Date.now();
  return `${formatShortDate(expiryDate)}까지${isExpired ? ' · 소비기한 지남' : ''}`;
}

function renderReceiptItems(items, memory) {
  return items.map((item) => `
    <li>
      <span>${escapeHtml(item.name)}${item.quantity ? ` (${escapeHtml(item.quantity)})` : ''}</span>
      <span class="receipt-insight-actions">
        <em>${escapeHtml(getIngredientExpiryLabel(item, memory))}</em>
        <button type="button" data-receipt-item-delete="${escapeHtml(item.id || item.name)}" aria-label="${escapeHtml(item.name)} 다 먹은 것으로 표시하고 삭제" title="다 먹었어요">삭제</button>
      </span>
    </li>
  `).join('');
}

function renderReceiptInsight(recipe, leftPage) {
  if (!leftPage || leftPage.querySelector('[data-receipt-insight]')) return;
  const memory = readReceiptMemory();
  const matchedItems = filterReceiptItemsForRecipe(recipe, memory);
  if (!matchedItems.length) return;
  const date = getReceiptDate(memory);
  const section = document.createElement('section');
  section.dataset.receiptInsight = 'true';
  section.className = 'recipe-receipt-insight';
  section.style.marginTop = '14px';
  section.innerHTML = `
    <strong>🧾 이 레시피에 필요한 영수증 식재료</strong>
    <small>기준일: ${escapeHtml(formatShortDate(date))}${memory.purchaseDate ? ' (구매일)' : ' (영수증 첨부일)'} · 일치 품목 ${matchedItems.length}개</small>
    <ul>${renderReceiptItems(matchedItems, memory)}</ul>
  `;
  const meta = leftPage.querySelector('.notebook-detail-meta');
  if (meta) meta.insertAdjacentElement('afterend', section);
  else leftPage.appendChild(section);
}

export function hasActiveRecipeFilters() {
  return selectedCuisines.size > 0
    || activeDifficultyFilter !== 'all'
    || Boolean(recipeSearchQuery.trim());
}

const cuisineKeywords = {
  한식: ['김치', '비빔', '찌개', '국', '탕', '불고기', '잡채', '김밥', '된장', '감자볶음', '계란말이', '볶음', '반찬'],
  양식: ['파스타', '토스트', '샌드위치', '피자', '스테이크', '샐러드', '팬케이크', '오믈렛', '그라탕', '리조또', '치즈'],
  일식: ['돈부리', '규동', '우동', '오니기리', '초밥', '카레', '타코야키', '가츠', '덮밥'],
  중식: ['짜장', '짬뽕', '마파', '탕수육', '깐풍', '유산슬', '춘권', '만두']
};

const cuisineOverrides = {
  '알리오 올리오': '양식',
  샌드위치: '양식',
  토스트: '양식',
  오므라이스: '일식',
  볶음우동: '일식',
  햄야채볶음: '한식',
  계란국: '한식',
  덮밥: '한식',
  돼지고기덮밥: '한식',
  '돼지고기 덮밥': '한식',
  짜장면: '중식',
  짬뽕: '중식',
  탕수육: '중식'
};

const seasoningTips = {
  감자전: '반죽에는 소금을 아주 조금만 넣고, 간장·식초 양념장을 곁들여 먹을 때 최종 간을 맞추세요.',
  볶음밥: '간장은 팬 가장자리에 둘러 향을 낸 뒤 넣고, 밥의 수분이 날아간 다음 소금으로 마지막 간을 보세요.',
  오므라이스: '볶음밥은 케첩을 충분히 졸인 뒤 소금 한 꼬집만 더하고, 계란에는 소금을 아주 약하게 넣어 균형을 맞추세요.',
  덮밥: '간장·굴소스는 처음부터 많이 넣지 말고 소스를 졸인 뒤 맛을 보며 한 번에 조금씩 보충하세요.',
  카레라이스: '카레가루를 넣은 뒤 5분 정도 끓여 농도를 본 다음, 부족할 때만 소금이나 간장으로 보정하세요.',
  비빔면: '고추장·식초·설탕을 먼저 섞어 맛을 맞추고, 면을 넣은 뒤에는 양념을 조금씩 추가해 짠맛을 피하세요.',
  '알리오 올리오': '면수 자체를 살짝 짭짤하게 준비하고, 마지막에 면수 한두 숟갈로 유화한 뒤 소금은 끝에만 보충하세요.',
  토마토파스타: '토마토소스를 먼저 충분히 졸여 산미와 수분을 줄인 뒤 소금으로 간하고, 면수는 조금씩 넣어 농도를 조절하세요.',
  볶음우동: '굴소스는 채소와 면을 볶은 마지막 단계에 넣고, 면수나 물을 소량 더해 짠맛을 부드럽게 맞추세요.',
  우동: '다시다 육수의 염도를 먼저 확인한 뒤 간장을 나누어 넣고, 대파를 넣기 직전에 최종 간을 보세요.',
  잔치국수: '육수는 처음부터 짜게 하지 말고 끓인 뒤 국간장으로 맞추며, 김치나 양념장을 곁들일 경우 간을 더 약하게 하세요.',
  비빔국수: '양념장은 고추장보다 식초와 설탕의 균형을 먼저 맞추고, 면을 비빈 뒤 부족한 양념만 추가하세요.',
  김치찌개: '김치와 돼지고기를 먼저 볶아 감칠맛을 낸 뒤 끓이고, 김치의 염도를 확인한 다음 소금은 마지막에 결정하세요.',
  된장찌개: '된장을 육수에 먼저 풀고 채소가 익은 뒤 간을 보세요. 된장마다 염도가 달라 소금 추가는 거의 필요하지 않을 수 있어요.',
  순두부찌개: '고춧가루와 마늘을 볶은 기름에 육수를 더한 뒤, 순두부가 들어간 마지막에 국간장이나 소금으로 약하게 맞추세요.',
  부대찌개: '스팸·소시지·김치에서 염분이 나오므로 충분히 끓인 뒤 맛을 보고, 부족할 때만 고춧가루보다 소량의 간장으로 보충하세요.',
  미역국: '미역과 소고기를 참기름에 볶은 뒤 끓이고, 국간장은 한 번에 넣지 말고 끓이는 중간과 마지막에 나누어 넣으세요.',
  계란국: '계란을 넣기 전에 육수와 간장을 먼저 맞추고, 계란을 넣은 뒤에는 젓지 말고 한소끔 끓여 부드러운 맛을 살리세요.',
  햄야채볶음: '스팸과 굴소스가 이미 짤 수 있으니 채소를 먼저 볶고 굴소스는 불을 줄인 마지막에 조금씩 넣으세요.',
  계란말이: '계란물에는 소금을 과하지 않게 넣고 5분 정도 두어 녹인 뒤, 한 번에 많이 붓지 말고 얇게 나누어 부치세요.',
  감자볶음: '감자가 거의 익었을 때 소금을 넣어 수분이 빠지는 것을 줄이고, 마지막에 후추와 소금으로 간을 정리하세요.',
  토스트: '계란물에는 설탕과 소금을 각각 한 꼬집만 넣어 단짠 균형을 만들고, 잼이나 케첩을 곁들일 때는 소금을 줄이세요.',
  샌드위치: '마요네즈 속 계란과 채소에 소금을 따로 많이 넣지 말고, 마요네즈와 후추로 먼저 버무린 뒤 마지막에 한 번만 간을 보세요.'
};

const cookingMethods = {
  감자전: '감자 2개를 갈아 물기를 가볍게 짜고, 부침가루 2큰술·계란 1개·소금 1/3작은술을 섞습니다. 팬에 식용유 2큰술을 두르고 중불에서 앞뒤로 노릇하게 부칩니다.',
  볶음밥: '밥 1공기와 다진 채소를 준비합니다. 팬에 식용유 1큰술을 두르고 채소와 계란 1개를 볶은 뒤 밥을 넣습니다. 팬 가장자리에 진간장 1큰술을 둘러 볶고, 부족하면 소금 1~2꼬집으로 마무리합니다.',
  오므라이스: '양파 1/4개를 볶고 밥 1공기·케첩 2큰술·소금 1/4작은술을 넣어 볶습니다. 계란 2개에 소금 1꼬집을 풀어 얇게 익힌 뒤 볶음밥을 감쌉니다.',
  덮밥: '돼지고기 150g과 양파 1/2개를 볶습니다. 진간장 1큰술·굴소스 1/2큰술·설탕 1/2큰술·물 3큰술을 섞어 넣고 자작하게 졸인 뒤 밥 1공기 위에 올립니다.',
  카레라이스: '감자 1개·당근 1/3개·양파 1/2개를 식용유 1큰술에 볶고 물 400ml를 넣어 익힙니다. 불을 약하게 줄여 카레가루 3큰술을 풀고 5분 더 끓인 뒤 밥에 붓습니다.',
  비빔면: '고추장 2큰술·식초 1/2큰술·설탕 1/2큰술·간장 1/2큰술·참기름 1작은술을 섞습니다. 삶아 찬물에 헹군 국수 1인분에 양념장을 2/3부터 넣고 맛을 보며 추가합니다.',
  '알리오 올리오': '스파게티면 100g을 소금 1큰술을 넣은 물에 삶습니다. 올리브유 3큰술에 마늘 4쪽을 볶고 면과 면수 3큰술을 넣어 섞습니다. 마지막에 소금 1꼬집과 후추로 맞춥니다.',
  토마토파스타: '면 100g을 삶고, 올리브유 1큰술에 마늘 2쪽·양파 1/4개를 볶습니다. 토마토소스 200g을 넣어 5분 졸인 뒤 면과 면수 2큰술을 넣고 소금 1/3작은술로 마무리합니다.',
  볶음우동: '우동면 1인분을 데칩니다. 식용유 1큰술에 양배추와 당근을 볶고 면을 넣습니다. 굴소스 1큰술·진간장 1/2큰술·설탕 1/3작은술·물 2큰술을 넣어 볶습니다.',
  우동: '물 500ml에 다시다 1/2작은술을 풀어 끓입니다. 진간장 1큰술·소금 1/4작은술로 국물 간을 맞추고 우동면 1인분을 넣습니다. 대파 1/3대를 마지막에 올립니다.',
  잔치국수: '물 600ml에 다시다 1작은술을 풀고 진간장 1큰술·소금 1/4작은술로 육수를 맞춥니다. 국수 1인분을 따로 삶아 넣고 계란지단과 대파를 올립니다.',
  비빔국수: '고추장 2큰술·식초 1큰술·설탕 1큰술·진간장 1/2큰술·참기름 1작은술을 섞습니다. 국수 1인분에 양념을 2/3만 먼저 넣고 비빈 뒤 새콤함과 단맛을 조절합니다.',
  김치찌개: '돼지고기 150g과 김치 1컵을 참기름 1작은술에 볶습니다. 물 400ml와 고춧가루 1/2큰술을 넣고 15분 끓인 뒤 두부와 대파를 넣습니다. 부족할 때만 국간장 1/2큰술을 추가합니다.',
  된장찌개: '물 400ml에 된장 1큰술을 풀고 감자·양파·애호박을 넣어 끓입니다. 두부를 넣은 뒤 다진 마늘 1/2작은술과 고춧가루 1/3작은술을 넣고, 마지막에 소금으로 간을 조절합니다.',
  순두부찌개: '식용유 1큰술에 고춧가루 1큰술·다진 마늘 1/2큰술을 약불로 볶습니다. 물 300ml와 순두부 1봉을 넣고 끓인 뒤 진간장 1/2큰술·소금 1/4작은술로 맞추고 계란 1개를 넣습니다.',
  부대찌개: '스팸 100g·소시지 100g·김치 1/2컵에 물 500ml를 넣습니다. 고춧가루 1큰술·진간장 1큰술·다진 마늘 1/2큰술을 넣고 15분 끓인 뒤, 맛을 보고 부족할 때만 소금 1꼬집을 추가합니다.',
  미역국: '불린 미역 1컵과 소고기 100g을 참기름 1큰술에 볶습니다. 물 600ml를 넣고 20분 끓인 뒤 국간장 1큰술·소금 1/4작은술로 간을 맞춥니다.',
  계란국: '물 500ml에 다시다 1/2작은술과 진간장 1큰술을 넣어 끓입니다. 계란 2개를 풀어 천천히 넣고 대파를 올립니다. 마지막에 소금 1~2꼬집으로만 조절합니다.',
  햄야채볶음: '스팸 100g과 양파·당근·양배추를 식용유 1큰술에 볶습니다. 굴소스 1큰술·케첩 1큰술·설탕 1/3작은술을 넣고 센 불에서 1분 더 볶습니다.',
  계란말이: '계란 3개에 소금 1/3작은술·물 1큰술을 풀고 다진 당근과 대파를 섞습니다. 팬에 식용유를 얇게 두르고 계란물을 3~4번 나누어 부어 약불에서 말아줍니다.',
  감자볶음: '감자 1개와 당근·양파를 채 썹니다. 식용유 1큰술에 감자를 먼저 볶고 물 2큰술을 넣어 익힌 뒤 소금 1/3작은술과 후추로 마무리합니다.',
  토스트: '계란 1개에 설탕 1/2큰술·소금 1꼬집을 풀어 식빵 2장에 묻힙니다. 식용유 1큰술에 앞뒤로 굽고, 취향에 따라 설탕이나 잼을 소량 곁들입니다.',
  샌드위치: '삶은 계란 2개를 으깨 마요네즈 2큰술·소금 1꼬집·후추 약간을 섞습니다. 식빵에 양배추와 계란 샐러드를 올리고, 간을 본 뒤 빵을 덮습니다.'
};

const extraIngredientTips = {
  감자전: '쪽파·청양고추·새우를 추가하면 향과 감칠맛이 살아납니다. 반죽을 얇게 펴고 새우를 올려 함께 부치세요.',
  볶음밥: '대파·굴소스·참기름·김가루를 추가하면 풍미가 깊어집니다. 대파를 기름에 먼저 볶아 향을 낸 뒤 밥을 넣으세요.',
  오므라이스: '우유 1큰술과 버터 1작은술을 계란에 넣으면 더 부드럽고, 다진 햄이나 완두콩을 볶음밥에 넣으면 식감이 좋아집니다.',
  덮밥: '생강 1/2작은술·대파·계란 노른자를 추가하면 돼지고기의 잡내가 줄고 소스의 깊이가 커집니다. 마지막에 노른자를 올려 비벼 드세요.',
  카레라이스: '다진 마늘 1/2작은술과 버터 1작은술을 추가하면 향이 풍부해집니다. 불을 끈 뒤 버터를 넣어 녹이세요.',
  비빔면: '참기름 1작은술·깨 1작은술·삶은 계란을 추가하면 고소함과 식감이 좋아집니다. 양념을 비빈 뒤 마지막에 넣으세요.',
  '알리오 올리오': '페페론치노 1~2개·파슬리·새우를 추가하면 향과 감칠맛이 좋아집니다. 마늘이 노릇해지기 직전에 페페론치노를 넣으세요.',
  토마토파스타: '베이컨·바질·파마산 치즈를 추가하면 풍미가 선명해집니다. 치즈는 불을 끈 뒤 면수와 함께 섞으세요.',
  볶음우동: '가쓰오부시·대파·숙주를 추가하면 일식 볶음우동의 향과 아삭한 식감이 살아납니다. 가쓰오부시는 불을 끈 뒤 올리세요.',
  우동: '유부·가쓰오부시·표고버섯을 추가하면 국물이 더 깊어집니다. 가쓰오부시는 오래 끓이지 말고 불을 끈 뒤 우려내세요.',
  잔치국수: '애호박·김가루·깨·참기름을 추가하면 고명과 고소한 향이 풍성해집니다. 참기름은 그릇에 담은 뒤 몇 방울만 넣으세요.',
  비빔국수: '김가루·오이·삶은 계란을 추가하면 매운맛이 부드러워지고 식감이 좋아집니다. 오이는 소금에 절이지 않고 바로 올리세요.',
  김치찌개: '다진 마늘·대파·두부·돼지고기 목살을 추가하면 국물의 깊이가 커집니다. 대파는 마지막 5분에 넣어 향을 살리세요.',
  된장찌개: '멸치·다시마 육수와 표고버섯·청양고추를 추가하면 구수함과 감칠맛이 강해집니다. 다시마는 끓기 직전에 건지세요.',
  순두부찌개: '바지락·돼지고기·참기름을 추가하면 감칠맛이 좋아집니다. 참기름에 고춧가루를 볶은 뒤 바지락을 먼저 익히세요.',
  부대찌개: '라면사리·대파·치즈 1장을 추가하면 풍성하고 부드러워집니다. 치즈는 마지막 1분에 올려 국물에 살짝 녹이세요.',
  미역국: '다진 마늘·참기름·소고기 양지 또는 조개를 추가하면 국물 맛이 깊어집니다. 마늘은 고기를 볶을 때 함께 넣으세요.',
  계란국: '대파·후추·참기름 몇 방울을 추가하면 깔끔한 국물에 향이 더해집니다. 참기름은 불을 끈 뒤 넣어 향을 보존하세요.',
  햄야채볶음: '마늘·대파·후추·케첩을 추가하면 햄의 풍미가 선명해집니다. 케첩은 굴소스와 함께 마지막 1분에 넣으세요.',
  계란말이: '치즈·명란·쪽파를 추가하면 속재료가 풍성해집니다. 치즈는 계란물이 반쯤 익었을 때 중앙에 올려 말아주세요.',
  감자볶음: '베이컨·청양고추·참깨를 추가하면 감칠맛과 향이 좋아집니다. 베이컨을 먼저 볶아 나온 기름에 감자를 볶으세요.',
  토스트: '버터·치즈·햄·딸기잼을 추가하면 단짠 조합이 좋아집니다. 치즈와 햄은 빵이 따뜻할 때 넣어 녹이세요.',
  샌드위치: '후추·머스터드·치즈·토마토를 추가하면 풍미와 촉촉함이 좋아집니다. 토마토의 물기는 닦고 마지막에 넣으세요.'
};

const RECIPE_DETAIL_INFO = {
  seasoningTips,
  cookingMethods,
  extraIngredientTips
};

function getCanonicalRecipeName(recipe) {
  const recipeName = String(recipe?.name || '').trim();
  return ['덮밥', '돼지고기덮밥', '돼지고기 덮밥'].includes(recipeName)
    ? '덮밥'
    : recipeName;
}

function getExtraIngredientTip(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.extraIngredientTips[recipeName] || '대파·마늘·후추를 소량 추가하고, 향신 재료는 마지막에 넣어 재료 본연의 맛을 살려보세요.';
}

function getCookingMethod(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.cookingMethods[recipeName] || (recipe?.steps || []).join(' → ');
}

function getSeasoningTip(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.seasoningTips[recipeName]
    || '재료에서 나오는 염도를 먼저 확인하고, 조리가 끝나기 직전에 한 꼬집씩 보충해 가장 알맞은 간을 맞추세요.';
}

function getRecipeName(recipe) {
  return getCanonicalRecipeName(recipe) === '덮밥'
    ? '돼지고기 덮밥'
    : recipe?.name;
}

function classifyCuisine(recipe) {
  const recipeName = String(recipe?.name || '').trim();
  if (recipe?.cuisineType) return recipe.cuisineType;
  if (cuisineOverrides[recipeName]) return cuisineOverrides[recipeName];
  if (String(recipe?.id || '').startsWith('alt')) return '편의점';
  const text = [recipe.name, recipe.category, ...(recipe.ingredients || [])].join(' ');
  const matched = Object.entries(cuisineKeywords)
    .map(([cuisine, keywords]) => ({
      cuisine,
      score: keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  // 데이터에 명확한 외국 음식 단서가 없으면 기본 한식으로 분류합니다.
  return matched[0]?.score > 0 ? matched[0].cuisine : '한식';
}

const preferenceRules = [
  { keywords: ['매운'], test: (recipe) => contains(recipe, ['매운', '고추', '김치', '찌개', '볶음']) },
  { keywords: ['다이어트'], test: (recipe) => contains(recipe, ['샐러드', '채소', '두부', '닭', '계란']) },
  { keywords: ['고단백'], test: (recipe) => contains(recipe, ['고기', '닭', '계란', '두부', '참치', '새우']) },
  { keywords: ['국물'], test: (recipe) => contains(recipe, ['국', '탕', '찌개', '라면', '우동']) },
  { keywords: ['밥요리'], test: (recipe) => contains(recipe, ['밥', '볶음밥', '덮밥', '김밥']) },
  { keywords: ['면요리'], test: (recipe) => contains(recipe, ['면', '라면', '우동', '파스타', '국수']) },
  { keywords: ['간식'], test: (recipe) => contains(recipe, ['토스트', '샌드위치', '팬케이크', '과자', '간식']) },
  { keywords: ['간단한 요리'], test: (recipe) => recipe.difficulty === '쉬움' || getMinutes(recipe) <= 15 },
  { keywords: ['10분'], test: (recipe) => getMinutes(recipe) <= 10 },
  { keywords: ['쉬움'], test: (recipe) => recipe.difficulty === '쉬움' },
  { keywords: ['보통'], test: (recipe) => recipe.difficulty === '보통' },
  { keywords: ['어려움'], test: (recipe) => recipe.difficulty === '어려움' },
  { keywords: ['아침'], test: (recipe) => getMinutes(recipe) <= 20 || contains(recipe, ['토스트', '밥', '계란']) },
  { keywords: ['야식'], test: (recipe) => contains(recipe, ['라면', '면', '볶음', '치즈', '밥']) },
  { keywords: ['냉장고 털이'], test: (recipe) => recipe.missing.length <= 1 },
  { keywords: ['저녁'], test: (recipe) => getMinutes(recipe) >= 15 || recipe.difficulty !== '쉬움' },
  { keywords: ['혼밥'], test: (recipe) => getMinutes(recipe) <= 25 && !contains(recipe, ['찌개', '국']) },
  { keywords: ['술안주'], test: (recipe) => contains(recipe, ['볶음', '전', '튀김', '치즈', '햄', '감자']) },
  { keywords: ['손님용'], test: (recipe) => contains(recipe, ['볶음', '파스타', '전', '오므라이스', '샌드위치']) },
  { keywords: ['도시락'], test: (recipe) => !contains(recipe, ['국', '찌개', '탕']) && getMinutes(recipe) <= 30 }
];

function getMinutes(recipe) {
  const value = String(recipe?.time || '').match(/\d+/);
  return value ? Number(value[0]) : Number.MAX_SAFE_INTEGER;
}

function contains(recipe, words) {
  const text = [recipe.name, recipe.category, ...(recipe.ingredients || [])].join(' ').toLowerCase();
  return words.some((word) => text.includes(word.toLowerCase()));
}

function getPreferenceRule(label) {
  return preferenceRules.find((rule) => rule.keywords.some((keyword) => label.includes(keyword)));
}

function isFilterPreference(label) {
  return Boolean(getPreferenceRule(label));
}

export function applyRecipeFilters() {
  const sourceRecipes = Array.isArray(state.recipePool) && state.recipePool.length > 0
    ? state.recipePool
    : state.carouselRecipes;
  if (!Array.isArray(sourceRecipes)) return;

  const recipes = sourceRecipes.map((recipe) => {
    const preferenceScore = [...selectedPreferences].reduce((score, label) => {
      const rule = getPreferenceRule(label);
      return score + (rule && rule.test(recipe) ? 1 : 0);
    }, 0);

    return {
      ...recipe,
      name: getRecipeName(recipe),
      cuisine: classifyCuisine(recipe),
      preferenceScore
    };
  });

  if (state.showingAlternatives) {
    state.carouselRecipes = recipes.sort(
      (a, b) => b.rate - a.rate || getMinutes(a) - getMinutes(b),
    );
    state.currentCarouselIndex = 0;
    return;
  }

  const availableRecipes = recipes.filter((recipe) =>
    activeDifficultyFilter === 'all' || recipe.difficulty === activeDifficultyFilter
  );
  const filterPreferences = [...selectedPreferences].filter(isFilterPreference);
  const cuisineFilteredRecipes = selectedCuisines.size
    ? availableRecipes.filter((recipe) => selectedCuisines.has(recipe.cuisine))
    : availableRecipes;
  const filteredRecipes = filterPreferences.length
    ? cuisineFilteredRecipes.filter((recipe) => filterPreferences.some((label) => {
      const rule = getPreferenceRule(label);
      return rule && rule.test(recipe);
    }))
    : cuisineFilteredRecipes;

  const query = normalizeSearchText(recipeSearchQuery);
  const searchedRecipes = query
    ? filteredRecipes.filter((recipe) =>
      normalizeSearchText([recipe.name, recipe.cuisine, recipe.category].join(' ')).includes(query)
    )
    : filteredRecipes;

  searchedRecipes.sort((a, b) =>
    b.rate - a.rate ||
    b.preferenceScore - a.preferenceScore ||
    (a.missing?.length || 0) - (b.missing?.length || 0) ||
    getMinutes(a) - getMinutes(b)
  );

  // 메뉴는 전체 필터 결과를 사용하고, 캐러셀만 매칭율 상위 10개로 제한합니다.
  state.carouselRecipes = state.recipeViewMode === 'menu'
    ? searchedRecipes
    : searchedRecipes.slice(0, 10);
  const visibleRecipes = state.carouselRecipes;
  if (state.currentCarouselIndex >= visibleRecipes.length) state.currentCarouselIndex = 0;
}

function addCuisineChoices() {
  const modalContent = document.querySelector('#taste-modal .taste-modal-content');
  if (!modalContent || modalContent.querySelector('[data-cuisine-filter]')) return;

  const section = document.createElement('div');
  section.dataset.cuisineFilter = 'true';
  section.className = 'taste-section';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h4 class="taste-section-title">요리 종류</h4>
    <div class="chip-container">
      ${Object.keys(cuisineKeywords).map((cuisine) => `
        <button type="button" class="chip-btn" data-cuisine="${cuisine}">${cuisine}</button>
      `).join('')}
    </div>
  `;
  modalContent.insertBefore(section, modalContent.querySelector('.modal-actions'));
}

function rememberTasteChoices() {
  selectedPreferences.clear();
  selectedCuisines.clear();
  document.querySelectorAll('#taste-modal .chip-btn.active').forEach((chip) => {
    const label = chip.textContent.trim();
    selectedPreferences.add(label);
    const cuisine = ['한식', '양식', '일식', '중식'].find((name) => label.includes(name));
    if (cuisine) selectedCuisines.add(cuisine);
  });
}

export function decorateRecipeCard() {
  if (state.route !== 'recipes' || state.recipeViewMode !== 'menu') return;
  const recipesContainer = document.querySelector('.recipes-container');
  if (recipesContainer && !recipesContainer.querySelector('[data-recipe-toolbar]')) {
    const toolbar = document.createElement('div');
    toolbar.dataset.recipeToolbar = 'true';
    toolbar.style.cssText = 'margin:0 auto 18px; max-width:760px; padding:14px; border:2px solid var(--color-charcoal); border-radius:var(--br-lg); background:var(--color-cream); box-shadow:0 4px 0 var(--color-charcoal);';
    toolbar.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px;">
        ${['all', '한식', '중식', '일식', '양식', '편의점'].map((cuisine) => `
          <button type="button" class="chip-btn ${cuisine === 'all' && selectedCuisines.size === 0 ? 'active' : ''}" data-cuisine-filter="${cuisine}">
            ${cuisine === 'all' ? '전체' : cuisine}
          </button>
        `).join('')}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px;">
        ${['all', '쉬움', '보통', '어려움'].map((difficulty) => `
          <button type="button" class="chip-btn ${difficulty === activeDifficultyFilter ? 'active' : ''}" data-difficulty-filter="${difficulty}">
            ${difficulty === 'all' ? '난이도 전체' : difficulty}
          </button>
        `).join('')}
      </div>
      <label style="display:block;">
        <span style="display:block; margin-bottom:5px; font-size:13px; font-weight:800;">레시피 검색</span>
        <input type="search" value="${escapeHtml(recipeSearchQuery)}" data-recipe-search placeholder="레시피 이름을 검색하세요!" style="box-sizing:border-box; width:100%; padding:10px 12px; border:2px solid var(--color-charcoal); border-radius:var(--br-md); background:#fff; font:inherit;">
      </label>
    `;
    const carousel = recipesContainer.querySelector('.carousel-wrapper');
    if (carousel) recipesContainer.insertBefore(toolbar, carousel);
    else recipesContainer.prepend(toolbar);
  }

  // 필터 변경 후에도 버튼이 현재 선택 상태를 반영하도록 동기화합니다.
  recipesContainer?.querySelectorAll('[data-cuisine-filter]').forEach((button) => {
    const cuisine = button.dataset.cuisineFilter;
    const isActive = cuisine === 'all'
      ? selectedCuisines.size === 0
      : selectedCuisines.has(cuisine);
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  recipesContainer?.querySelectorAll('[data-difficulty-filter]').forEach((button) => {
    const isActive = button.dataset.difficultyFilter === activeDifficultyFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (!state.carouselRecipes.length) return;

  if (recipesContainer) {
    const carousel = recipesContainer.querySelector('.carousel-wrapper');
    const dots = recipesContainer.querySelector('.carousel-dots');
    const carouselCount = [...recipesContainer.children].find((child) => child.tagName === 'P');
    if (carousel) carousel.style.display = 'none';
    if (dots) dots.style.display = 'none';
    if (carouselCount) carouselCount.style.display = 'none';

    let overview = recipesContainer.querySelector('[data-recipe-overview]');
    if (!overview) {
      overview = document.createElement('div');
      overview.dataset.recipeOverview = 'true';
      if (carousel) recipesContainer.insertBefore(overview, carousel);
      else recipesContainer.appendChild(overview);
    }

    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(state.carouselRecipes.length / pageSize));
    recipePage = Math.min(recipePage, pageCount);
    const pageRecipes = state.carouselRecipes.slice((recipePage - 1) * pageSize, recipePage * pageSize);
    overview.style.cssText = 'width:100%; max-width:1400px; margin:0 auto 18px;';
    overview.innerHTML = `
      <div style="display:grid; width:100%; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:16px; align-items:stretch;">
        ${pageRecipes.length ? pageRecipes.map((recipe) => `
          <article class="recipe-card-box" style="width:100%; min-width:0; box-sizing:border-box; display:flex; flex-direction:column;">
            <div class="recipe-card-header" style="min-height:48px;">${recipe.emoji || '🍽️'}</div>
            <div class="recipe-card-body" style="padding:12px; flex:1; display:flex; flex-direction:column;">
              <h3 class="recipe-card-title" style="font-size:16px; word-break:keep-all;">${escapeHtml(getRecipeName(recipe))}</h3>
              <div class="recipe-meta-tags" style="margin:8px 0;">
                <span class="recipe-meta-tag">${recipe.difficulty || ''}</span>
                <span class="recipe-meta-tag">⏱️ ${recipe.time || ''}</span>
              </div>
              <div style="font-size:12px; line-height:1.5; margin-bottom:10px;">
                매치율 ${recipe.rate || 0}%<br>
                부족한 재료 ${recipe.missing?.length || 0}개<br>
                ${recipe.missing?.length ? escapeHtml(recipe.missing.join(', ')) : '부족한 재료 없음'}
              </div>
              <button type="button" class="btn btn-primary" data-overview-recipe="${recipe.id}" style="width:100%; margin-top:auto; padding:7px 4px; font-size:12px;">자세히 보기</button>
            </div>
          </article>
        `).join('') : '<p style="grid-column:1/-1; padding:30px; text-align:center;">검색 조건에 맞는 레시피가 없어요.</p>'}
      </div>
      ${pageCount > 1 ? `
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
          <button type="button" class="btn btn-outline" data-recipe-page="prev" ${recipePage === 1 ? 'disabled' : ''}>이전</button>
          <strong>${recipePage} / ${pageCount}</strong>
          <button type="button" class="btn btn-outline" data-recipe-page="next" ${recipePage === pageCount ? 'disabled' : ''}>다음</button>
        </div>
      ` : ''}
    `;
  }

}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function refreshRecipeResults() {
  updateCarouselRecipes();
  applyRecipeFilters();
  state.currentCarouselIndex = 0;
  recipePage = 1;
  render();
  decorateRecipeCard();
  const searchInput = document.querySelector('[data-recipe-search]');
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFC').toLowerCase().trim();
}

function scheduleRecipeSearch(searchInput) {
  clearTimeout(searchRefreshTimer);
  searchRefreshTimer = setTimeout(() => {
    if (isSearchComposing || !document.body.contains(searchInput)) return;
    recipeSearchQuery = searchInput.value;
    refreshRecipeResults();
  }, 180);
}

export function decorateDetailPage() {
  if (state.route !== 'detail') return;
  const aiReason = document.querySelector('.notebook-ai-reason');
  const detailContainer = document.querySelector('.detail-container');
  if (!detailContainer) return;

  const recipe = [...RECIPES, ...ALTERNATIVE_RECIPES].find((item) => item.id === state.currentDetail);
  if (!recipe) return;

  document.querySelectorAll('.notebook-notepad .notepad-title').forEach((title) => {
    if (title.textContent.includes('주방 순서')) title.textContent = '🍳 조리방법';
  });

  const leftPage = detailContainer.querySelector('.notebook-left-page');
  if (leftPage && !leftPage.querySelector('[data-extra-ingredients]')) {
    const extraIngredients = document.createElement('section');
    extraIngredients.dataset.extraIngredients = 'true';
    extraIngredients.style.cssText = 'margin-top:14px; padding:12px; border:2px dashed var(--color-mint-deep); border-radius:var(--br-md); background:var(--color-mint-light); color:var(--color-charcoal); font-size:13px; line-height:1.6; text-align:left;';
    extraIngredients.innerHTML = `
      <strong>✨ 더 맛있게 추가해보세요</strong>
      <p style="margin:7px 0 0;">${escapeHtml(getExtraIngredientTip(recipe))}</p>
    `;
    const meta = leftPage.querySelector('.notebook-detail-meta');
    if (meta) meta.insertAdjacentElement('afterend', extraIngredients);
    else leftPage.appendChild(extraIngredients);
  }

  // 좌측의 감성적인 AI 설명은 제거하고, 구체적인 조리방법은 우측 순서 영역에 넣습니다.
  if (aiReason) aiReason.remove();
  const stepsList = detailContainer.querySelector('.notepad-steps');
  if (stepsList && !stepsList.dataset.detailedCookingMethod) {
    stepsList.dataset.detailedCookingMethod = 'true';
    const methodSteps = getCookingMethod(recipe)
      .split(/(?<=\.)\s+/)
      .filter(Boolean);
    stepsList.innerHTML = methodSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const seasoningStep = document.createElement('li');
    seasoningStep.innerHTML = `<strong>간 맞춤:</strong> ${escapeHtml(getSeasoningTip(recipe))}`;
    stepsList.appendChild(seasoningStep);
  }
  renderReceiptInsight(recipe, leftPage);

}

function resetRecommendationFiltersForMenu() {
  selectedPreferences.clear();
  selectedCuisines.clear();
  recipeSearchQuery = '';
  activeDifficultyFilter = 'all';
  recipePage = 1;
  state.showingAlternatives = false;
  state.recipeSource = 'all';
  document.querySelectorAll('#taste-modal .chip-btn.active').forEach((chip) => {
    chip.classList.remove('active');
    chip.setAttribute('aria-pressed', 'false');
  });
}

export function initRecommend() {
  addCuisineChoices();
  startReceiptMemoryObserver();

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('[data-receipt-history-open]')) {
      openReceiptLibrary();
      return;
    }

    if (target.closest('[data-receipt-history-clear]')) {
      if (!window.confirm('저장된 영수증과 연결된 분석 내역을 모두 삭제할까요?')) return;
      clearStoredReceiptImages().then(() => {
        writeReceiptAnalyses([]);
        writeReceiptMemory({ items: [] });
        refreshReceiptInsights();
        listStoredReceiptImages().then((items) => renderReceiptLibrary(items));
        showToast('저장된 영수증을 모두 삭제했어요.');
      });
      return;
    }

    if (target.closest('[data-receipt-history-close]') || target.matches('[data-receipt-history-library]')) {
      closeReceiptLibrary();
      return;
    }

    const receiptItemDelete = target.closest('[data-receipt-item-delete]');
    if (receiptItemDelete) {
      deleteReceiptAnalysisItem(receiptItemDelete.dataset.receiptItemDelete);
      receiptItemDelete.closest('li')?.remove();
      showToast('다 먹은 영수증 식재료를 삭제했어요.');
      return;
    }

    const historyPreview = target.closest('[data-receipt-history-preview]');
    if (historyPreview) {
      listStoredReceiptImages().then((items) => renderReceiptLibrary(items, historyPreview.dataset.receiptHistoryPreview));
      return;
    }

    const historySelect = target.closest('[data-receipt-history-select]');
    if (historySelect) {
      selectStoredReceiptImage(historySelect.dataset.receiptHistorySelect);
      return;
    }

    const historyDelete = target.closest('[data-receipt-history-delete]');
    if (historyDelete) {
      const imageId = historyDelete.dataset.receiptHistoryDelete;
      deleteStoredReceiptImage(imageId).then(() => {
        deleteReceiptAnalysisForImage(imageId);
        listStoredReceiptImages().then((items) => renderReceiptLibrary(items));
        showToast('기억한 영수증을 삭제했어요.');
      });
      return;
    }

    if (target.closest('#btn-receipt-upload, #btn-receipt-choose, #btn-receipt-reselect')) {
      receiptAttachedAt = new Date().toISOString();
      queueMicrotask(ensureReceiptHistoryPanel);
    }
    if (target.closest('#btn-receipt-analyze')) {
      captureReceiptResult();
    }

    const recipesNavigation = event.target.closest('[data-nav="recipes"]');
    if (recipesNavigation) {
      resetRecommendationFiltersForMenu();
      refreshRecipeResults();
      return;
    }

    const resetRecipeFilters = event.target.closest('#btn-reset-recipe-filters');
    if (resetRecipeFilters) {
      selectedPreferences.clear();
      selectedCuisines.clear();
      recipeSearchQuery = '';
      activeDifficultyFilter = 'all';
      state.showingAlternatives = false;
      state.recipeSource = 'all';
      state.recipeViewMode = 'menu';
      refreshRecipeResults();
      return;
    }

    // 💥 중복/비동기 버그를 일으키던 queueMicrotask(syncRenderedView)와 data-nav="recipes" 수동 렌더 트리거 소거
    
    // 이스터에그: 토끼 요리사 클릭 시 음식 폭죽 팡 터짐!
    const bunny = event.target.closest('.home-hero-img');
    if (bunny) {
      triggerBunnyExplosion(event, bunny);
      return;
    }

    if (event.target.closest('#btn-suggest-recipes')) {
      const tasteModal = document.getElementById('taste-modal');
      if (tasteModal) {
        tasteModal.classList.add('show');
      }
      return;
    }

    const tasteClose = event.target.closest('.btn-taste-close');
    const tasteSuggest = event.target.closest('.btn-taste-suggest');
    if (tasteClose || tasteSuggest) {
      if (tasteClose) {
        // 1. 모달 내 활성화된 모든 칩 active 클래스 제거
        document.querySelectorAll('#taste-modal .chip-btn').forEach((chip) => {
          chip.classList.remove('active');
        });
        // 2. 필터 데이터 비우기
        selectedPreferences.clear();
        selectedCuisines.clear();
      } else if (tasteSuggest) {
        const tasteModal = document.getElementById('taste-modal');
        if (tasteModal) {
          tasteModal.classList.remove('show');
        }
        rememberTasteChoices();
        state.recipeViewMode = 'carousel';
        state.currentCarouselIndex = 0; // 새 추천 시 인덱스를 항상 0으로 리셋
        navigate('recipes');
        applyRecipeFilters();
        render();
      }
      return;
    }

    // 취향 및 상황 칩 버튼 선택 토글 UI 조작
    const cuisineChip = event.target.closest('[data-cuisine]');
    if (cuisineChip) {
      const cuisine = cuisineChip.dataset.cuisine;
      if (selectedCuisines.has(cuisine)) selectedCuisines.delete(cuisine);
      else selectedCuisines.add(cuisine);
      cuisineChip.classList.toggle('active', selectedCuisines.has(cuisine));
      return;
    }

    const cuisineFilter = event.target.closest('[data-cuisine-filter]');
    if (cuisineFilter) {
      const cuisine = cuisineFilter.dataset.cuisineFilter;
      selectedCuisines.clear();
      if (cuisine !== 'all') selectedCuisines.add(cuisine);
      state.showingAlternatives = cuisine === '편의점';
      state.recipeSource = cuisine === 'all'
        ? 'all'
        : cuisine === '편의점'
          ? 'alternative'
          : 'normal';
      refreshRecipeResults();
      return;
    }

    const difficultyFilter = event.target.closest('[data-difficulty-filter]');
    if (difficultyFilter) {
      activeDifficultyFilter = difficultyFilter.dataset.difficultyFilter;
      refreshRecipeResults();
      return;
    }

    const overviewRecipe = event.target.closest('[data-overview-recipe]');
    if (overviewRecipe) {
      state.detailBackRoute = 'recipes';
      navigate('detail', overviewRecipe.dataset.overviewRecipe);
      return;
    }

    const pageButton = event.target.closest('[data-recipe-page]');
    if (pageButton) {
      const pageCount = Math.max(1, Math.ceil(state.carouselRecipes.length / 10));
      recipePage = Math.max(1, Math.min(pageCount, recipePage + (pageButton.dataset.recipePage === 'next' ? 1 : -1)));
      render(); // 동기적으로 render 호출하면 app.js의 render 내에서 자동으로 그리드가 다시 그려짐!
      return;
    }

    const chip = event.target.closest('.chip-btn');
    if (chip) {
      chip.classList.toggle('active');
      return;
    }

    const searchInput = event.target.closest('[data-recipe-search]');
    if (searchInput) return;

    if (event.target.closest('#btn-dislike-recipe')) {
      state.showingAlternatives = !state.showingAlternatives;
      state.recipeSource = state.showingAlternatives ? 'alternative' : 'normal';
      state.recipeViewMode = 'carousel';
      window.__routingActive = true; // 편의점 레시피 전환 시 우아한 실크 페이드 유도
      refreshRecipeResults();
      showToast(state.showingAlternatives
        ? '편의점 꿀조합 레시피를 불러왔어요!'
        : '일반 맞춤 추천 레시피로 돌아왔어요.');
      return;
    }

    // 💥 app.js와 100% 중복되던 캐러셀 슬라이더(prev, next, dot) 핸들러 제거
  });

  document.addEventListener('change', (event) => {
    if (!event.target.matches('#receipt-file-input')) return;
    const file = event.target.files?.[0];
    if (file && !suppressNextReceiptImageSave) {
      saveReceiptImage(file).then((record) => {
        if (record) activeReceiptImageId = record.id;
        refreshReceiptHistoryPanel();
      });
    }
    suppressNextReceiptImageSave = false;
    queueMicrotask(ensureReceiptHistoryPanel);
  });

  document.addEventListener('input', (event) => {
    const searchInput = event.target.closest('[data-recipe-search]');
    if (!searchInput) return;
    if (isSearchComposing) return;
    scheduleRecipeSearch(searchInput);
  });

  document.addEventListener('compositionstart', (event) => {
    if (event.target.closest('[data-recipe-search]')) isSearchComposing = true;
  });

  document.addEventListener('compositionend', (event) => {
    const searchInput = event.target.closest('[data-recipe-search]');
    if (!searchInput) return;
    isSearchComposing = false;
    scheduleRecipeSearch(searchInput);
  });
}

// 토끼 클릭 폭죽 이스터에그 엔진 (마우스 좌표 핀포인트 버전)
function triggerBunnyExplosion(event, bunnyElement) {
  const emojis = ['🥕', '🍳', '🍅', '🧀', '🍞', '🥔', '🥬', '🧅', '🦐', '🥩', '🥛', '🥞', '🍙', '🍜', '🍕', '🍯', '🍒', '🍪'];
  const originX = event.pageX;
  const originY = event.pageY;

  for (let i = 0; i < 9; i++) {
    const particle = document.createElement('span');
    particle.className = 'bunny-burst-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance - 20}px`);
    particle.style.setProperty('--rot', `${Math.random() * 180 - 90}deg`);
    particle.style.left = `${originX - 9}px`;
    particle.style.top = `${originY - 9}px`;

    document.body.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
}
