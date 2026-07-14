//------------------------------------
// 담당 : 지호
// 수정 가능
//------------------------------------
/* 추천 기능 모듈 */

import { state, showToast, render, navigate, updateCarouselRecipes } from './app.js';

export function initRecommend() {
  document.addEventListener('click', (event) => {
    // 이스터에그: 토끼 요리사 클릭 시 음식 폭죽 팡 터짐!
    const bunny = event.target.closest('.home-hero-img');
    if (bunny) {
      triggerBunnyExplosion(event, bunny);
      return;
    }

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
      window.__routingActive = true; // 편의점 레시피 전환 시 우아한 실크 페이드 유도
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

// 토끼 클릭 폭죽 이스터에그 엔진 (마우스 좌표 핀포인트 버전)
function triggerBunnyExplosion(event, bunnyElement) {
  const emojis = ['🥕', '🍳', '🍅', '🧀', '🍞', '🥔', '🥬', '🧅', '🦐', '🥩', '🥛', '🥞', '🍙', '🍜', '🍕', '🍯', '🍒', '🍪'];
  const originX = event.pageX;
  const originY = event.pageY;

  for (let i = 0; i < 9; i++) {
    const particle = document.createElement('span');
    particle.className = 'bunny-burst-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance - 20}px`);
    particle.style.setProperty('--rot', `${Math.random() * 180 - 90}deg`);
    particle.style.left = `${originX - 9}px`;
    particle.style.top = `${originY - 9}px`;

    document.body.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());
  }
}

