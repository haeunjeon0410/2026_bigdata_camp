//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 즐겨찾기 기능 모듈 */

import { state, showToast, render } from './app.js';

export function initFavorite() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recipe-id]');
    if (!button) return;

    if (button.id === 'btn-start-cooking' || button.id === 'btn-go-rating') return;

    event.stopPropagation();
    const recipeId = button.dataset.recipeId;
    if (!recipeId) return;

    if (state.favorites.has(recipeId)) {
      state.favorites.delete(recipeId);
      showToast('즐겨찾기 목록에서 뺐어요.');
    } else {
      state.favorites.add(recipeId);
      showToast('내 즐겨찾기 레시피에 저장 완료! ❤️');
    }

    render();
  });
}

