//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 레시피 및 조리 기능 모듈 */

import { state, showToast, render, navigate } from './app.js';

export function initRecipe() {
  document.addEventListener('click', (event) => {
    const start = event.target.closest('#btn-start-fridge');
    if (start) {
      navigate('fridge');
      return;
    }

    const bookCard = event.target.closest('.book-recipe-card');
    if (bookCard) {
      const isFavCard = bookCard.closest('.book-favorites-grid');
      const isDiscovered = bookCard.classList.contains('discovered');
      if (isFavCard || isDiscovered) {
        if (event.target.closest('[data-recipe-id]')) return;
        if (bookCard.dataset.rid) {
          navigate('detail', bookCard.dataset.rid);
          return;
        }
      }
    }

    const steps = event.target.closest('#btn-view-steps');
    if (steps) {
      navigate('detail', steps.dataset.rid);
      return;
    }

    if (event.target.closest('#btn-detail-back')) {
      navigate(state.detailBackRoute || 'recipes');
      return;
    }

    if (event.target.closest('#btn-view-shopping')) {
      showToast('장바구니에 담았습니다!');
      return;
    }

    const cooking = event.target.closest('#btn-start-cooking');
    if (cooking) {
      navigate('cooking', cooking.dataset.recipeId);
      return;
    }

    const rating = event.target.closest('#btn-go-rating');
    if (rating) {
      navigate('rating', rating.dataset.recipeId);
      return;
    }

    const choice = event.target.closest('.rating-options button');
    if (choice) {
      state.ratingFeedback = choice.dataset.choice;
      render();
      showToast('💌 평가를 반영했어요. 감사합니다!');
      return;
    }

    // 도감 난이도 필터 선택 토글 및 리렌더링
    const diffBtn = event.target.closest('[data-diff]');
    if (diffBtn) {
      state.mypageDifficultyFilter = diffBtn.dataset.diff;
      render();
      return;
    }
  });
}


