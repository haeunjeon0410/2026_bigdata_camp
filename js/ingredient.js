//------------------------------------
// 담당 : 소민
// 수정 가능
//------------------------------------
/* 재료 기능 모듈 */

import {
  state,
  showToast,
  render as appRender,
  updateCarouselRecipes,
  saveSelectedIngredients,
} from "./app.js";
import { INGREDIENTS } from "./data.js";

const CUSTOM_INGREDIENTS_KEY = "customIngredients";
const CUSTOM_INGREDIENT_CATEGORIES = new Set([
  "dairy",
  "vegetable",
  "meat",
  "grain",
  "sauce",
  "seasoning",
]);
const CUSTOM_INGREDIENT_EMOJIS = {
  dairy: "🥛",
  vegetable: "🥦",
  meat: "🥓",
  grain: "🍞",
  sauce: "🫙",
  seasoning: "🧂",
};
const INGREDIENT_CATEGORY_META = {
  all: { label: "전체 식재료", emoji: "✨" },
  dairy: { label: "유제품·달걀", emoji: "🥛" },
  vegetable: { label: "채소·과일", emoji: "🥦" },
  meat: { label: "고기·가공품", emoji: "🥓" },
  grain: { label: "곡류·식사", emoji: "🍞" },
  sauce: { label: "소스·오일", emoji: "🫙" },
  seasoning: { label: "가루·조미료", emoji: "🧂" },
};

function loadCustomIngredients() {
  let storedIngredients;
  try {
    storedIngredients = localStorage.getItem(CUSTOM_INGREDIENTS_KEY);
  } catch {
    return [];
  }
  if (!storedIngredients) return [];

  try {
    const parsedIngredients = JSON.parse(storedIngredients);
    if (!Array.isArray(parsedIngredients)) return [];
    return parsedIngredients.filter(
      (ingredient) =>
        ingredient &&
        typeof ingredient.id === "string" &&
        typeof ingredient.name === "string" &&
        CUSTOM_INGREDIENT_CATEGORIES.has(ingredient.category) &&
        typeof ingredient.emoji === "string",
    );
  } catch {
    return [];
  }
}

function saveCustomIngredients(ingredients) {
  const customIngredients = Array.isArray(ingredients) ? ingredients : [];
  try {
    localStorage.setItem(
      CUSTOM_INGREDIENTS_KEY,
      JSON.stringify(customIngredients),
    );
    return true;
  } catch {
    showToast("재료 저장에 실패했어요.");
    return false;
  }
}

let showCategoryCandidates = false;
let pendingCustomIngredientName = "";
let isInitialized = false;
let isComposingSearch = false;

function normalizeIngredientName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function createCustomIngredientId(ingredients) {
  const existingIds = new Set(ingredients.map((ingredient) => ingredient.id));
  let suffix = 1;
  let id = `custom-${Date.now()}`;
  while (existingIds.has(id)) {
    id = `custom-${Date.now()}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function getDefaultStorage(category) {
  if (category === "vegetable") return "drawer";
  if (category === "dairy") return "shelf-1";
  if (category === "grain" || category === "meat") return "shelf-2";
  return "shelf-3";
}

function getIngredientStorage(ingredient) {
  return ingredient.storage || getDefaultStorage(ingredient.category);
}

function addCustomIngredient(category) {
  if (!CUSTOM_INGREDIENT_CATEGORIES.has(category)) return false;

  const name = pendingCustomIngredientName.trim();
  if (!name) return false;

  const customIngredients = loadCustomIngredients();
  const allIngredients = [...INGREDIENTS, ...customIngredients];
  const normalizedName = normalizeIngredientName(name);
  const isDuplicate = allIngredients.some(
    (ingredient) => normalizeIngredientName(ingredient.name) === normalizedName,
  );
  if (isDuplicate) return false;

  const newIngredient = {
    id: createCustomIngredientId(allIngredients),
    name,
    category,
    storage: getDefaultStorage(category),
    emoji: CUSTOM_INGREDIENT_EMOJIS[category],
    isCustom: true,
  };
  customIngredients.push(newIngredient);
  if (!saveCustomIngredients(customIngredients)) return false;
  state.selected.add(newIngredient.id);
  saveSelectedIngredients();
  pendingCustomIngredientName = "";
  state.search = "";
  return true;
}

function applyIngredientVisibility() {
  document
    .querySelectorAll(
      ".fridge-cavity-interior .ingredient-sticker, .fridge-drawer-vegetable .ingredient-sticker",
    )
    .forEach((sticker) => {
      const visible = state.selected.has(sticker.dataset.ing);
      sticker.style.display = visible ? "inline-flex" : "none";
      sticker.classList.toggle("selected", visible);
      sticker.setAttribute("aria-checked", String(visible));
    });
}

function getShelfItemsForIngredient(ingredient) {
  const storage = getIngredientStorage(ingredient);
  if (storage === "drawer") {
    return document.querySelector(".fridge-drawer-vegetable .drawer-items");
  }
  return document.querySelector(`#${storage} .shelf-items`);
}

function createFridgeSticker(ingredient) {
  const sticker = document.createElement("div");
  sticker.className = "ingredient-sticker selected";
  sticker.setAttribute("data-selected-fridge", "true");
  sticker.dataset.ing = ingredient.id;
  sticker.title = ingredient.name;
  sticker.setAttribute("role", "checkbox");
  sticker.setAttribute("aria-checked", "true");
  sticker.style.cssText = "--tilt: 0deg; display: inline-flex;";
  sticker.innerHTML = `
    <span class="sticker-chk" aria-hidden="true">×</span>
    <span class="sticker-emoji">${escapeHtml(ingredient.emoji)}</span>
    <span class="sticker-name">${escapeHtml(ingredient.name)}</span>
  `;
  return sticker;
}

function renderSelectedIngredientsInFridge() {
  const fridgeStickers = document.querySelectorAll(
    ".fridge-cavity-interior .ingredient-sticker, .fridge-drawer-vegetable .ingredient-sticker",
  );
  const allIngredients = [...INGREDIENTS, ...loadCustomIngredients()];
  const selectedIds = new Set(
    allIngredients
      .filter((ingredient) => state.selected.has(ingredient.id))
      .map((ingredient) => ingredient.id),
  );
  const storageTargets = {
    "shelf-1": "#shelf-1",
    "shelf-2": "#shelf-2",
    "shelf-3": "#shelf-3",
    drawer: ".fridge-drawer-vegetable",
  };
  Object.entries(storageTargets).forEach(([storage, selector]) => {
    const selectedCount = allIngredients.filter(
      (ingredient) =>
        selectedIds.has(ingredient.id) &&
        getIngredientStorage(ingredient) === storage,
    ).length;
    const storageElement = document.querySelector(selector);
    storageElement?.classList.toggle(
      "ingredient-density-compact",
      selectedCount >= 5 && selectedCount < 8,
    );
    storageElement?.classList.toggle(
      "ingredient-density-dense",
      selectedCount >= 8 && selectedCount < 10,
    );
    storageElement?.classList.toggle(
      "ingredient-density-ultra",
      selectedCount >= 10,
    );
  });

  fridgeStickers.forEach((sticker) => {
    if (!selectedIds.has(sticker.dataset.ing)) {
      if (sticker.hasAttribute("data-selected-fridge")) sticker.remove();
    }
  });

  allIngredients
    .filter(
      (ingredient) => selectedIds.has(ingredient.id) && ingredient.isCustom,
    )
    .forEach((ingredient) => {
      const existing = [
        ...document.querySelectorAll(
          ".fridge-cavity-interior .ingredient-sticker, .fridge-drawer-vegetable .ingredient-sticker",
        ),
      ].find((sticker) => sticker.dataset.ing === ingredient.id);
      if (existing) return;

      const shelfItems = getShelfItemsForIngredient(ingredient);
      if (!shelfItems) return;
      shelfItems
        .querySelector(".shelf-empty")
        ?.style.setProperty("display", "none");
      shelfItems.appendChild(createFridgeSticker(ingredient));
    });

  [
    "#shelf-1 .shelf-items",
    "#shelf-2 .shelf-items",
    "#shelf-3 .shelf-items",
    ".fridge-drawer-vegetable .drawer-items",
  ].forEach((selector) => {
    const shelfItems = document.querySelector(selector);
    if (!shelfItems) return;
    const hasSelected = [
      ...shelfItems.querySelectorAll(".ingredient-sticker"),
    ].some((sticker) => selectedIds.has(sticker.dataset.ing));
    const emptyState = shelfItems.querySelector(".shelf-empty");
    if (emptyState) emptyState.style.display = hasSelected ? "none" : "";
  });
}

function ensureSearchResultsArea() {
  const existingArea = document.querySelector("[data-search-results]");
  const fridgeContainer = document.querySelector(
    ".interactive-fridge-container",
  );
  const hungryBunny = fridgeContainer?.querySelector(
    ".fridge-hungry-bunny-wrap",
  );
  if (!fridgeContainer || !hungryBunny) return null;

  if (existingArea) {
    existingArea.classList.add("ingredient-search-results");
    const isInPlace =
      existingArea.parentElement === fridgeContainer &&
      existingArea.nextElementSibling === hungryBunny;
    if (!isInPlace) {
      fridgeContainer.insertBefore(existingArea, hungryBunny);
    }
    return existingArea;
  }

  const area = document.createElement("section");
  area.className = "ingredient-search-results";
  area.setAttribute("data-search-results", "true");
  fridgeContainer.insertBefore(area, hungryBunny);
  return area;
}

function updateSearchResults() {
  const area = ensureSearchResultsArea();
  if (!area) return;

  const search = state.search;
  const allIngredients = [...INGREDIENTS, ...loadCustomIngredients()];
  const categoryMatches =
    state.activeCategory === "all"
      ? allIngredients
      : allIngredients.filter(
          (ingredient) => ingredient.category === state.activeCategory,
        );
  const results = search
    ? categoryMatches.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(search),
      )
    : showCategoryCandidates
      ? categoryMatches
      : [];
  const hasAnyMatch = search
    ? allIngredients.some((ingredient) =>
        ingredient.name.toLowerCase().includes(search),
      )
    : false;
  const signature = `${search}|${state.activeCategory}|${showCategoryCandidates}|${results.map((ingredient) => `${ingredient.id}:${state.selected.has(ingredient.id)}`).join(",")}`;
  if (area.dataset.renderedSearch === signature) return;

  if (!search && !showCategoryCandidates) {
    area.hidden = true;
    area.innerHTML = "";
  } else if (search && results.length === 0) {
    const escapedSearch = escapeHtml(search);
    area.hidden = false;
    area.innerHTML = `
      <div class="empty-message">
        <p>‘${escapedSearch}’에 대한 검색 결과가 없습니다.</p>
        <p>다른 이름으로 검색해보세요.</p>
        ${hasAnyMatch ? "" : `<button type="button" id="btn-add-custom-ingredient" class="custom-ingredient-add">&#39;${escapedSearch}&#39; 추가하기</button>`}
      </div>
    `;
  } else {
    const categoryMeta =
      INGREDIENT_CATEGORY_META[state.activeCategory] ||
      INGREDIENT_CATEGORY_META.all;
    const stickers = results
      .map(
        (ingredient) => `
      <div class="ingredient-sticker ${state.selected.has(ingredient.id) ? "selected" : ""}"
           data-search-result="true"
           data-ing="${escapeHtml(ingredient.id)}"
           role="checkbox"
           aria-checked="${state.selected.has(ingredient.id)}"
           style="--tilt: 0deg;">
        <span class="sticker-chk">✔</span>
        <span class="sticker-emoji">${escapeHtml(ingredient.emoji)}</span>
        <span class="sticker-name">${escapeHtml(ingredient.name)}</span>
      </div>
    `,
      )
      .join("");

    area.hidden = false;
    area.innerHTML = `
      <div class="ingredient-results-header">
        <h3 class="${search ? "search-results-title" : "category-results-title"}">
          <span aria-hidden="true">${search ? "🔎" : categoryMeta.emoji}</span>
          ${search ? "검색 결과" : categoryMeta.label}
        </h3>
        <div class="ingredient-bulk-actions" aria-label="재료 일괄 선택">
          <button type="button" data-ingredient-bulk="select">전체 선택</button>
          <button type="button" data-ingredient-bulk="clear">선택 해제</button>
        </div>
      </div>
      <div class="ingredient-candidate-list">${stickers}</div>
    `;
  }
  area.dataset.renderedSearch = signature;
}

function render() {
  appRender();
  refreshIngredientView();
}

function renderIngredientList() {
  applyIngredientVisibility();
  renderSelectedIngredientsInFridge();
  updateSearchResults();
}

function refreshIngredientView() {
  renderIngredientList();
  updateFooter();
}

export function initIngredient() {
  if (isInitialized) return;
  isInitialized = true;

  applyIngredientVisibility();
  updateSearchResults();

  document.addEventListener("fridge:ingredients-added", refreshIngredientView);

  document.addEventListener("click", (event) => {
    const fridgeEntry = event.target.closest(
      '[data-nav="fridge"], #btn-start-fridge',
    );
    if (fridgeEntry) {
      showCategoryCandidates = false;
      state.search = "";
      const searchInput = document.querySelector("#fridge-search-input");
      if (searchInput) searchInput.value = "";
      setTimeout(() => render(), 0);
      return;
    }

    const navElement = event.target.closest("[data-nav]");
    if (navElement) return;

    const addButton = event.target.closest("#btn-add-custom-ingredient");
    if (addButton) {
      const name = state.search.trim();
      const allIngredients = [...INGREDIENTS, ...loadCustomIngredients()];
      const normalizedName = normalizeIngredientName(name);
      const isDuplicate = allIngredients.some(
        (ingredient) =>
          normalizeIngredientName(ingredient.name) === normalizedName,
      );
      if (!name || isDuplicate) return;

      pendingCustomIngredientName = name;
      if (CUSTOM_INGREDIENT_CATEGORIES.has(state.activeCategory)) {
        if (addCustomIngredient(state.activeCategory)) {
          showCategoryCandidates = true;
          render();
          updateCarouselRecipes();
          showToast(
            `${name}을(를) ${INGREDIENT_CATEGORY_META[state.activeCategory].label}에 추가했어요.`,
          );
        } else {
          pendingCustomIngredientName = "";
        }
        return;
      }
      showToast("카테고리를 선택해주세요.");
      return;
    }

    const bulkAction = event.target.closest("[data-ingredient-bulk]");
    if (bulkAction) {
      const ingredientIds = [
        ...document.querySelectorAll(
          "[data-search-results] [data-search-result][data-ing]",
        ),
      ].map((sticker) => sticker.dataset.ing);
      if (bulkAction.dataset.ingredientBulk === "select") {
        ingredientIds.forEach((id) => state.selected.add(id));
        showToast(`${ingredientIds.length}개 재료를 선택했어요.`);
      } else {
        ingredientIds.forEach((id) => state.selected.delete(id));
        showToast("현재 재료의 선택을 해제했어요.");
      }
      saveSelectedIngredients();
      refreshIngredientView();
      updateCarouselRecipes();
      return;
    }

    const sticker = event.target.closest(".ingredient-sticker");
    if (sticker) {
      const id = sticker.dataset.ing;
      if (state.selected.has(id)) {
        state.selected.delete(id);
        sticker.classList.remove("selected");
        sticker.setAttribute("aria-checked", "false");
      } else {
        state.selected.add(id);
        sticker.classList.add("selected");
        sticker.setAttribute("aria-checked", "true");

        // 🍮 1번 애니메이션: 식재료 스티커 젤리 쫀득 팝 (마음에 안 들면 이 한 줄 지우기 가능)
        sticker.classList.add("pop-jelly");
        setTimeout(() => sticker.classList.remove("pop-jelly"), 350);
      }
      saveSelectedIngredients();
      refreshIngredientView();
      updateCarouselRecipes();
      return;
    }

    if (event.target.closest("#btn-fridge-clear")) {
      state.selected.clear();
      saveSelectedIngredients();
      document.querySelectorAll(".ingredient-sticker").forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-checked", "false");
      });
      refreshIngredientView();
      updateCarouselRecipes();
      showToast("선택한 재료를 모두 초기화했어요.");
      return;
    }

    const pocket = event.target.closest(".door-pocket");
    if (pocket) {
      const customIngredientName = pendingCustomIngredientName;
      if (customIngredientName && pocket.dataset.cat === "all") {
        showToast("추가할 재료의 세부 카테고리를 선택해주세요.");
        return;
      }
      if (
        pendingCustomIngredientName &&
        addCustomIngredient(pocket.dataset.cat)
      ) {
        state.activeCategory = pocket.dataset.cat;
        showCategoryCandidates = true;
        render();
        updateCarouselRecipes();
        showToast(
          `${customIngredientName}을(를) ${INGREDIENT_CATEGORY_META[pocket.dataset.cat].label}에 추가했어요.`,
        );
        return;
      }

      state.search = "";
      pendingCustomIngredientName = "";
      state.activeCategory = pocket.dataset.cat;
      showCategoryCandidates = true;
      render();
      return;
    }

    if (event.target.closest(".door-front")) {
      state.isFridgeOpen = true;
      document
        .querySelector(".interactive-fridge")
        ?.classList.add("fridge-open");
      return;
    }

    if (event.target.closest(".door-back")) {
      state.isFridgeOpen = false;
      document
        .querySelector(".interactive-fridge")
        ?.classList.remove("fridge-open");
      return;
    }

    // 이스터에그: 배고픈 토끼 클릭 시 말풍선 피어오르고 2.8초 뒤 스르륵 소멸
    const hungryBunny = event.target.closest(".fridge-hungry-bunny");
    if (hungryBunny) {
      const bubble = document.querySelector(".hungry-bubble");
      if (bubble) {
        bubble.classList.add("show-bubble");
        clearTimeout(window._bunnyBubbleTimer);
        window._bunnyBubbleTimer = setTimeout(() => {
          bubble.classList.remove("show-bubble");
        }, 1800);
      }
      return;
    }
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches("#fridge-search-input")) return;
    state.search = event.target.value.toLowerCase().trim();
    pendingCustomIngredientName = "";
    if (!state.search) showCategoryCandidates = false;
    if (event.isComposing || isComposingSearch) return;
    renderIngredientList();
  });

  document.addEventListener("compositionstart", (event) => {
    if (!event.target.matches("#fridge-search-input")) return;
    isComposingSearch = true;
  });

  document.addEventListener("compositionend", (event) => {
    if (!event.target.matches("#fridge-search-input")) return;
    isComposingSearch = false;
    state.search = event.target.value.toLowerCase().trim();
    if (!state.search) showCategoryCandidates = false;
    renderIngredientList();
  });
}

function updateFooter() {
  const count = state.selected.size;
  const countElement = document.querySelector(".selected-status span");
  if (countElement) countElement.textContent = count;

  document
    .querySelectorAll("#btn-fridge-clear, #btn-suggest-recipes")
    .forEach((button) => {
      button.disabled = count === 0;
    });
}
