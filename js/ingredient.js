//------------------------------------
// 담당 : 소민
// 수정 가능
//------------------------------------
/* 재료 기능 모듈 */

// ✅ 확인만
// ⬜ TODO(신규)

import { state, showToast, render, updateCarouselRecipes } from './app.js';
import { INGREDIENTS } from './data.js';

let showCategoryCandidates = false;

function applyIngredientVisibility() {
  document.querySelectorAll('.fridge-cavity-interior .ingredient-sticker, .fridge-drawer-vegetable .ingredient-sticker').forEach((sticker) => {
    const visible = state.selected.has(sticker.dataset.ing);
    sticker.style.display = visible ? 'inline-flex' : 'none';
    sticker.classList.toggle('selected', visible);
    sticker.setAttribute('aria-checked', String(visible));
  });
  renderSelectedIngredientsInFridge();
}

function getShelfItemsForIngredient(ingredient) {
  const shelfId = ingredient.category === 'dairy'
    ? 'shelf-1'
    : ingredient.category === 'grain' || ingredient.category === 'meat'
      ? 'shelf-2'
      : 'shelf-3';
  return document.querySelector(`#${shelfId} .shelf-items`);
}

function createFridgeSticker(ingredient) {
  const sticker = document.createElement('div');
  sticker.className = 'ingredient-sticker selected';
  sticker.setAttribute('data-selected-fridge', 'true');
  sticker.dataset.ing = ingredient.id;
  sticker.setAttribute('role', 'checkbox');
  sticker.setAttribute('aria-checked', 'true');
  sticker.style.cssText = '--tilt: 0deg; display: inline-flex;';
  sticker.innerHTML = `
    <span class="sticker-chk">✔</span>
    <span class="sticker-emoji">${ingredient.emoji}</span>
    <span class="sticker-name">${ingredient.name}</span>
  `;
  return sticker;
}

function renderSelectedIngredientsInFridge() {
  document.querySelector('[data-selected-ingredients]')?.remove();

  const fridgeStickers = document.querySelectorAll('.fridge-cavity-interior .ingredient-sticker, .fridge-drawer-vegetable .ingredient-sticker');
  const selectedIds = new Set(INGREDIENTS.filter((ingredient) => state.selected.has(ingredient.id)).map((ingredient) => ingredient.id));

  fridgeStickers.forEach((sticker) => {
    if (!selectedIds.has(sticker.dataset.ing)) {
      if (sticker.hasAttribute('data-selected-fridge')) sticker.remove();
      else {
        sticker.style.display = 'none';
        sticker.classList.remove('selected');
        sticker.setAttribute('aria-checked', 'false');
      }
    }
  });

  INGREDIENTS.filter((ingredient) => selectedIds.has(ingredient.id)).forEach((ingredient) => {
    const existing = document.querySelector(`.fridge-cavity-interior .ingredient-sticker[data-ing="${ingredient.id}"], .fridge-drawer-vegetable .ingredient-sticker[data-ing="${ingredient.id}"]`);
    if (existing) {
      existing.style.display = 'inline-flex';
      existing.classList.add('selected');
      existing.setAttribute('aria-checked', 'true');
      return;
    }

    const shelfItems = getShelfItemsForIngredient(ingredient);
    if (!shelfItems) return;
    shelfItems.querySelector('.shelf-empty')?.style.setProperty('display', 'none');
    shelfItems.appendChild(createFridgeSticker(ingredient));
  });

  ['shelf-1', 'shelf-2', 'shelf-3'].forEach((shelfId) => {
    const shelfItems = document.querySelector(`#${shelfId} .shelf-items`);
    if (!shelfItems) return;
    const hasSelected = [...shelfItems.querySelectorAll('.ingredient-sticker')]
      .some((sticker) => selectedIds.has(sticker.dataset.ing));
    const emptyState = shelfItems.querySelector('.shelf-empty');
    if (emptyState) emptyState.style.display = hasSelected ? 'none' : '';
  });
}

function ensureSearchResultsArea() {
  const existingArea = document.querySelector('[data-search-results]');
  const fridgeContainer = document.querySelector('.interactive-fridge-container');
  const host = fridgeContainer?.parentElement;
  const bottomActions = host?.querySelector('.fridge-bottom-actions');
  if (!fridgeContainer || !host) return null;

  if (existingArea) {
    const isInPlace = existingArea.parentElement === host
      && (bottomActions
        ? existingArea.nextElementSibling === bottomActions
        : existingArea.previousElementSibling === fridgeContainer);
    if (!isInPlace) {
      if (bottomActions) host.insertBefore(existingArea, bottomActions);
      else host.insertBefore(existingArea, fridgeContainer.nextElementSibling);
    }
    return existingArea;
  }

  const area = document.createElement('section');
  area.setAttribute('data-search-results', 'true');
  area.style.cssText = 'padding: 4px 14px 8px; max-height: 180px; overflow-y: auto; box-sizing: border-box;';
  if (bottomActions) host.insertBefore(area, bottomActions);
  else host.insertBefore(area, fridgeContainer.nextElementSibling);
  return area;
}

function updateSearchResults() {
  const area = ensureSearchResultsArea();
  if (!area) return;

  const search = state.search;
  const categoryMatches = state.activeCategory === 'all'
    ? INGREDIENTS
    : INGREDIENTS.filter((ingredient) => ingredient.category === state.activeCategory);
  const results = search
    ? categoryMatches.filter((ingredient) => ingredient.name.toLowerCase().includes(search))
    : showCategoryCandidates
      ? categoryMatches
      : [];
  const signature = `${search}|${state.activeCategory}|${showCategoryCandidates}|${results.map((ingredient) => `${ingredient.id}:${state.selected.has(ingredient.id)}`).join(',')}`;
  if (area.dataset.renderedSearch === signature) return;

  if (!search && !showCategoryCandidates) {
    area.hidden = true;
    area.innerHTML = '';
  } else if (search && results.length === 0) {
    const escapedSearch = search.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
    area.hidden = false;
    area.innerHTML = `
      <p style="margin: 0; font-size: 12px; color: var(--color-gray);">‘${escapedSearch}’에 대한 검색 결과가 없습니다.</p>
      <p style="margin: 4px 0 0; font-size: 11px; color: var(--color-gray);">다른 이름으로 검색해보세요.</p>
    `;
  } else {
    const stickers = results.map((ingredient) => `
      <div class="ingredient-sticker ${state.selected.has(ingredient.id) ? 'selected' : ''}"
           data-search-result="true"
           data-ing="${ingredient.id}"
           role="checkbox"
           aria-checked="${state.selected.has(ingredient.id)}"
           style="--tilt: 0deg; display: inline-flex; font-size: 12px; padding: 6px 10px;">
        <span class="sticker-chk">✔</span>
        <span class="sticker-emoji">${ingredient.emoji}</span>
        <span class="sticker-name">${ingredient.name}</span>
      </div>
    `).join('');

    area.hidden = false;
    area.innerHTML = `
      <h3 style="margin: 0 0 8px; font-size: 15px;">${search ? '검색 결과' : '카테고리 재료'}</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">${stickers}</div>
    `;
  }
  area.dataset.renderedSearch = signature;
}

export function initIngredient() {
  window.__moduleEventHandlersActive = true;

  const app = document.getElementById('app');
  if (app) {
    const renderObserver = new MutationObserver(() => {
      applyIngredientVisibility();
      updateSearchResults();
    });
    renderObserver.observe(app, { childList: true, subtree: true });
  }
  applyIngredientVisibility();
  updateSearchResults();

  document.addEventListener('click', (event) => {
    const sticker = event.target.closest('.ingredient-sticker');
    if (sticker) {
      const id = sticker.dataset.ing;
      if (state.selected.has(id)) {
        state.selected.delete(id);
        sticker.classList.remove('selected');
        sticker.setAttribute('aria-checked', 'false');
      } else {
        state.selected.add(id);
        sticker.classList.add('selected');
        sticker.setAttribute('aria-checked', 'true');
        
        // 🍮 1번 애니메이션: 식재료 스티커 젤리 쫀득 팝 (마음에 안 들면 이 한 줄 지우기 가능)
        sticker.classList.add('pop-jelly');
        setTimeout(() => sticker.classList.remove('pop-jelly'), 350);
      }
      renderSelectedIngredientsInFridge();
      updateSearchResults();
      updateFooter();
      updateCarouselRecipes();
      return;
    }

    if (event.target.closest('#btn-fridge-clear')) {
      state.selected.clear();
      document.querySelectorAll('.ingredient-sticker').forEach((item) => {
        item.classList.remove('selected');
        item.setAttribute('aria-checked', 'false');
      });
      renderSelectedIngredientsInFridge();
      updateSearchResults();
      updateFooter();
      updateCarouselRecipes();
      showToast('선택한 재료를 모두 초기화했어요.');
      return;
    }

    const pocket = event.target.closest('.door-pocket');
    if (pocket) {
      state.activeCategory = pocket.dataset.cat;
      showCategoryCandidates = true;
      render();
      applyIngredientVisibility();
      updateSearchResults();
      return;
    }

    if (event.target.closest('.door-front')) {
      state.isFridgeOpen = true;
      document.querySelector('.interactive-fridge')?.classList.add('fridge-open');
      return;
    }

    if (event.target.closest('.door-back')) {
      state.isFridgeOpen = false;
      document.querySelector('.interactive-fridge')?.classList.remove('fridge-open');
      return;
    }

    // 이스터에그: 배고픈 토끼 클릭 시 말풍선 피어오르고 2.8초 뒤 스르륵 소멸
    const hungryBunny = event.target.closest('.fridge-hungry-bunny');
    if (hungryBunny) {
      const bubble = document.querySelector('.hungry-bubble');
      if (bubble) {
        bubble.classList.add('show-bubble');
        clearTimeout(window._bunnyBubbleTimer);
        window._bunnyBubbleTimer = setTimeout(() => {
          bubble.classList.remove('show-bubble');
        }, 1800);
      }
      return;
    }
  });

  document.addEventListener('input', (event) => {
    if (!event.target.matches('#fridge-search-input')) return;
    state.search = event.target.value.toLowerCase().trim();
    if (state.search) showCategoryCandidates = true;
    applyIngredientVisibility();
    updateSearchResults();
  });
}

function updateFooter() {
  const count = state.selected.size;
  const countElement = document.querySelector('.selected-status span');
  if (countElement) countElement.textContent = count;
  
  document.querySelectorAll('#btn-fridge-clear, #btn-suggest-recipes').forEach((button) => {
    button.disabled = count === 0;
  });
}
