//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 즐겨찾기 기능 모듈 */

import { state, render } from './app.js';

const FAVORITE_ADDED_AT_KEY = 'favoriteAddedAt';

export function getFavoriteAddedAtMap() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITE_ADDED_AT_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function saveFavoriteAddedAtMap(map) {
  const safeMap = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  localStorage.setItem(FAVORITE_ADDED_AT_KEY, JSON.stringify(safeMap));
  return safeMap;
}

export function recordFavoriteAddedAt(recipeId) {
  const map = getFavoriteAddedAtMap();
  map[recipeId] = new Date().toISOString();
  saveFavoriteAddedAtMap(map);
}

export function removeFavoriteAddedAt(recipeId) {
  const map = getFavoriteAddedAtMap();
  delete map[recipeId];
  saveFavoriteAddedAtMap(map);
}

export function getFavoriteAddedAt(recipeId) {
  return getFavoriteAddedAtMap()[recipeId];
}

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
      removeFavoriteAddedAt(recipeId);
    } else {
      state.favorites.add(recipeId);
      recordFavoriteAddedAt(recipeId);
      // ❤️ 하트 이스터에그 팝업 파티클 발동! (찜할 때만 귀엽게 뿜어 나오도록 설계)
      triggerHeartBurst(event);
    }

    render();
  });
}

// 하트 파티클 이펙트 엔진 (마우스 좌표 핀포인트 버전)
function triggerHeartBurst(event) {
  const heartEmojis = ['❤️', '💖', '💗', '💕', '🧁']; // 뽀짝 하트와 미니 컵케이크 믹스
  const originX = event.pageX;
  const originY = event.pageY;
  const count = 3; // 시각적 피로가 없도록 아담한 3개 분사

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'heart-burst-particle';
    particle.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
    
    // 마우스 지점으로부터 상단 180도 방향으로 흩어지는 엇박자 포물선 좌표 연산
    const angle = Math.PI * 1.2 + Math.random() * Math.PI * 0.6; 
    const distance = 30 + Math.random() * 50; // 퍼짐 반경 30~80px
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 25; 
    
    const rot = (Math.random() * 60 - 30) + 'deg';
    
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.setProperty('--rot', rot);
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    
    document.body.appendChild(particle);
    
    // 0.8초 애니메이션 완료 후 DOM에서 흔적 없이 삭제
    setTimeout(() => {
      particle.remove();
    }, 800);
  }
}
