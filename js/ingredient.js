//------------------------------------
// 담당 : 소민
// 수정 가능
//------------------------------------
/* 재료 기능 모듈 */

import { state, showToast, render, updateCarouselRecipes } from './app.js';
import { INGREDIENTS } from './data.js';

export function initIngredient() {
  window.__moduleEventHandlersActive = true;

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
        sticker.classList.add('pop-bounce');
        setTimeout(() => sticker.classList.remove('pop-bounce'), 350);
      }
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
      updateFooter();
      updateCarouselRecipes();
      showToast('선택한 재료를 모두 초기화했어요.');
      return;
    }

    const pocket = event.target.closest('.door-pocket');
    if (pocket) {
      state.activeCategory = pocket.dataset.cat;
      render();
      return;
    }

    if (event.target.closest('.door-front')) {
      state.isFridgeOpen = true;
      document.querySelector('.interactive-fridge')?.classList.add('fridge-open');
      showToast('냉장고 문을 열었어요! 🥛✨');
      return;
    }

    if (event.target.closest('.door-back')) {
      state.isFridgeOpen = false;
      document.querySelector('.interactive-fridge')?.classList.remove('fridge-open');
      showToast('냉장고 문을 닫았어요.');
    }
  });

  document.addEventListener('input', (event) => {
    if (!event.target.matches('#fridge-search-input')) return;
    state.search = event.target.value.toLowerCase().trim();
    document.querySelectorAll('.ingredient-sticker').forEach((sticker) => {
      const name = sticker.querySelector('.sticker-name')?.textContent.toLowerCase() || '';
      sticker.style.display = name.includes(state.search) ? 'inline-flex' : 'none';
    });
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

