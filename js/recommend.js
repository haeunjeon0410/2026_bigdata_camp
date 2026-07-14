//------------------------------------
// 담당 : 지호
// 수정 가능
//------------------------------------
/* 추천 기능 모듈 */

import { state, showToast, render, navigate, updateCarouselRecipes } from './app.js';

export function initRecommend() {
  document.addEventListener('click', (event) => {
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
      const tasteModal = document.getElementById('taste-modal');
      if (tasteModal) {
        tasteModal.classList.remove('show');
      }
      navigate('recipes');
      return;
    }

    // 취향 및 상황 칩 버튼 선택 토글 UI 조작
    const chip = event.target.closest('.chip-btn');
    if (chip) {
      chip.classList.toggle('active');
      return;
    }

    if (event.target.closest('#btn-dislike-recipe')) {
      state.showingAlternatives = !state.showingAlternatives;
      updateCarouselRecipes();
      state.currentCarouselIndex = 0;
      render();
      showToast(state.showingAlternatives
        ? '편의점 꿀조합 레시피를 불러왔어요!'
        : '일반 맞춤 추천 레시피로 돌아왔어요.');
      return;
    }

    const previous = event.target.closest('#btn-carousel-prev');
    const next = event.target.closest('#btn-carousel-next');
    if (previous || next) {
      const length = state.carouselRecipes.length;
      if (!length) return;
      const offset = previous ? -1 : 1;
      state.currentCarouselIndex =
        (state.currentCarouselIndex + offset + length) % length;
      render();
      return;
    }

    const dot = event.target.closest('.carousel-dot');
    if (dot) {
      state.currentCarouselIndex = parseInt(dot.dataset.index, 10);
      render();
    }
  });
}

