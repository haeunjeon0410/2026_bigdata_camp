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
        
        // 🍮 1번 애니메이션: 식재료 스티커 젤리 쫀득 팝 (마음에 안 들면 이 한 줄 지우기 가능)
        sticker.classList.add('pop-jelly');
        setTimeout(() => sticker.classList.remove('pop-jelly'), 350);
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
