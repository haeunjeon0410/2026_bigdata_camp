//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 레시피 및 조리 기능 모듈 */

import { state, showToast, render, navigate } from './app.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeSubstituteTips(recipe) {
  if (!recipe || !Array.isArray(recipe.substituteTips)) return [];

  return recipe.substituteTips.map((tip) => {
    if (!tip || typeof tip !== 'object') return null;

    const original = String(tip.original || '').trim();
    const alternatives = (Array.isArray(tip.alternatives)
      ? tip.alternatives
      : [tip.alternatives])
      .filter((alternative) => alternative != null)
      .map((alternative) => String(alternative).trim())
      .filter(Boolean);
    const note = String(tip.note || '').trim();

    if (!original || alternatives.length === 0) return null;
    return { original, alternatives, note };
  }).filter(Boolean);
}

export function renderSubstituteTips(recipe) {
  const tips = normalizeSubstituteTips(recipe);
  if (tips.length === 0) return '';

  return `
    <div class="receipt-tips substitute-tips">
      <h4 class="tips-title">💡 대체 재료 팁</h4>
      <ul class="tips-list">
        ${tips.map((tip) => `
          <li>
            <strong>${escapeHtml(tip.original)}</strong> 대신 ${tip.alternatives.map(escapeHtml).join(', ')}
            ${tip.note ? `<span>${escapeHtml(tip.note)}</span>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

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
      if (state.detailBackRoute === 'recipes' && state.detailBackRecipeView) {
        state.recipeViewMode = state.detailBackRecipeView;
      }
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
      showToast('평가를 반영했어요!');
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


