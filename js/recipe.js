//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 레시피 및 조리 기능 모듈 */

import { state, showToast, render, navigate } from './app.js';
import { RECIPES, ALTERNATIVE_RECIPES } from './data.js';
import { addShoppingItems } from './shopping.js';

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

function getIngredientKeys(value) {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim().toLowerCase();
    return normalized ? [normalized] : [];
  }
  if (typeof value === 'object') {
    return [value.id, value.ingredientId, value.name, value.ingredientName, value.label]
      .filter((item) => item != null && String(item).trim())
      .map((item) => String(item).trim().toLowerCase());
  }
  return [];
}

function getIngredientName(need, recipeIngredient) {
  const needName = typeof need === 'object'
    ? [need.name, need.ingredientName, need.label].find((item) => item != null && String(item).trim())
    : null;
  const recipeName = typeof recipeIngredient === 'object'
    ? [recipeIngredient.name, recipeIngredient.ingredientName, recipeIngredient.label].find((item) => item != null && String(item).trim())
    : recipeIngredient;
  return String(needName || recipeName || need || '').trim();
}

function getIngredientAmount(need) {
  if (need && typeof need === 'object') {
    return String(need.amount || need.quantity || '1개').trim() || '1개';
  }
  return '1개';
}

function getMissingIngredients(recipe, selectedKeys) {
  if (String(recipe?.id || '').startsWith('alt') && Array.isArray(recipe.missing) && recipe.missing.length) {
    return recipe.missing
      .map((ingredientName) => ({ ingredientName: String(ingredientName).trim(), amount: '1개' }))
      .filter((item) => item.ingredientName);
  }

  return (Array.isArray(recipe?.need) ? recipe.need : [])
    .map((need, index) => {
      const recipeIngredient = recipe.ingredients?.[index];
      const needKeys = new Set([
        ...getIngredientKeys(need),
        ...getIngredientKeys(recipeIngredient)
      ]);
      if ([...needKeys].some((key) => selectedKeys.has(key))) return null;
      return {
        ingredientName: getIngredientName(need, recipeIngredient),
        amount: getIngredientAmount(need)
      };
    })
    .filter((item) => item && item.ingredientName);
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
      const recipe = [...RECIPES, ...ALTERNATIVE_RECIPES]
        .find((item) => item.id === state.currentDetail);
      const selectedValues = state.selected instanceof Set
        ? [...state.selected]
        : Array.isArray(state.selected)
          ? state.selected
          : [];
      const selectedKeys = new Set(selectedValues.flatMap(getIngredientKeys));
      const missingIngredients = recipe ? getMissingIngredients(recipe, selectedKeys) : [];

      if (missingIngredients.length === 0) {
        showToast('부족한 재료가 없습니다!');
        return;
      }

      const addedItems = addShoppingItems(missingIngredients.map(({ ingredientName, amount }) => ({
        ingredientName,
        amount,
        recipeId: recipe.id,
        recipeName: recipe.name,
        completed: false,
        addedAt: new Date().toISOString()
      })));

      showToast(addedItems.length > 0
        ? `부족한 재료 ${addedItems.length}개를 장보기 리스트에 담았어요!`
        : '이미 장보기 리스트에 담긴 재료입니다.');
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
