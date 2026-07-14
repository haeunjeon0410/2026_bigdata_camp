import { INGREDIENTS, RECIPES, ALTERNATIVE_RECIPES } from './data.js';
import { applyRecipeFilters, decorateRecipeCard } from './recommend.js';

// Initial State Management
export const state = {
  selected: new Set(), // 협업/테스트 검증을 위해 기본 선택 재료를 비워두었습니다.
  search: '',
  activeCategory: 'all',
  favorites: new Set(),
  route: 'home',
  // 메뉴바 레시피 탭과 냉장고에서 진입한 추천 캐러셀을 구분합니다.
  recipeViewMode: 'menu', // 'menu' | 'carousel'

  // Refrigerator open state
  isFridgeOpen: false,
  showingAlternatives: false, // track whether showing alternative 6 recipes
  cookedCounts: {}, // 협업/테스트 검증을 위해 기본 조리 횟수를 비워두었습니다.
  dislikedRecipeIds: new Set(), // 싫어하는 레시피 아이디 저장 Set

  // Recipe Carousel State
  carouselRecipes: [],
  currentCarouselIndex: 0,
  carouselDirection: null, // 'left' or 'right' or null

  // Detail page param
  currentDetail: null,
  detailBackRoute: 'recipes', // track where we came from ('recipes' or 'mypage')
  detailBackRecipeView: 'menu', // detail 진입 전 레시피 화면 ('menu' | 'carousel')

  // Cooking Flow Parameters
  cookingRecipeId: null,
  cookingProgress: 0,
  ratingFeedback: null,

  // My Page Book Filter
  mypageDifficultyFilter: 'all' // 'all', '쉬움', '보통', '어려움'
};

let cookingIntervalId = null;
let cookingTimeoutId = null;
let normalizeSubstituteTips = () => [];
let renderSubstituteTips = () => '';

// Toast notification Helper
export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Router and View Changer
export function navigate(route, param) {
  window.__routingActive = true; // 라우팅 전환 애니메이션 플래그 ON
  if (route !== 'cooking') {
    clearCookingFlowTimers();
  }
  if (route === 'detail') {
    state.currentDetail = param;
    // 오직 상세 카드 외부에서 처음 진입하는 순간에만 최초 진입 경로를 기억하여 유실되지 않도록 잠금 보존합니다.
    if (state.route !== 'detail') {
      state.detailBackRoute = state.route;
      state.detailBackRecipeView = state.route === 'recipes' ? state.recipeViewMode : null;
    }
  }

  state.route = route;

  if (route === 'recipes') {
    state.showingAlternatives = false; // Reset to match default recipes
    updateCarouselRecipes();
    // Default to first index if out of range, or reset
    if (state.currentCarouselIndex >= state.carouselRecipes.length || state.currentCarouselIndex < 0) {
      state.currentCarouselIndex = 0;
    }
  }
  if (route === 'cooking') {
    state.cookingRecipeId = param;
  }
  if (route === 'completed') {
    state.cookingRecipeId = param;
    if (param) {
      state.cookedCounts[param] = (state.cookedCounts[param] || 0) + 1;
      
      // 조리 완료 시 해당 요리에 들어간 식재료(need)를 state.selected에서 자동 삭제 차감
      let recipe = RECIPES.find(r => r.id === param);
      if (!recipe) recipe = ALTERNATIVE_RECIPES.find(r => r.id === param);
      if (recipe && recipe.need) {
        recipe.need.forEach(ingId => {
          state.selected.delete(ingId);
        });
      }
    }
  }
  if (route === 'rating') {
    state.cookingRecipeId = param;
    state.ratingFeedback = null; // reset feedback on rating screen entry
  }
  if (route === 'fridge') {
    state.isFridgeOpen = false; // Reset door to closed when entering fridge view
  }

  // Update navigation button active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === route);
  });

  // Close hamburger menu on navigation
  document.querySelector('.nav')?.classList.remove('open');

  // Re-render view
  render();

  // Scroll header smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Post-render initialization scripts
  if (route === 'cooking') {
    startCookingFlow(param);
  }
  if (route === 'completed') {
    spawnConfetti();
  }
}

// Update sorted carousel recipe lists relative to selections
function calculateMissingIngredients(recipe) {
  // 편의점 레시피는 need가 대표 재료 ID만 가지고 있어 기존 상세 missing 목록을 사용합니다.
  if (String(recipe?.id || '').startsWith('alt') && Array.isArray(recipe.missing) && recipe.missing.length) {
    return [...recipe.missing];
  }

  const need = recipe.need || [];
  return need
    .map((ingredientId, index) => state.selected.has(ingredientId)
      ? null
      : recipe.ingredients?.[index] || recipe.missing?.[index] || ingredientId)
    .filter(Boolean);
}

export function updateCarouselRecipes() {
  // If showing alternatives, pull from ALTERNATIVE_RECIPES database
  const sourcePool = state.showingAlternatives ? ALTERNATIVE_RECIPES : RECIPES;
  const list = [...sourcePool].map(r => {
    const need = r.need || [];
    const total = need.length;
    const missing = calculateMissingIngredients(r);
    const matched = need.filter(id => state.selected.has(id)).length;
    const rate = total === 0 ? 0 : Math.round((matched / total) * 100);
    return { ...r, missing, matched, total, rate };
  });

  // Sort: highest match rate first. If match rate is equal, sort by cooking time
  list.sort((a, b) => b.rate - a.rate || parseInt(a.time) - parseInt(b.time));
  state.carouselRecipes = list;
}

// Event Listeners for Nav delegation
document.addEventListener('click', (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    if (navEl.dataset.nav === 'recipes') state.recipeViewMode = 'menu';
    navigate(navEl.dataset.nav);
  }

  // 홈 화면 타이틀 뱃지 클릭 시 파이브가이즈 크레딧 팝업 활성화 이스터에그!
  if (e.target.closest('#btn-home-badge')) {
    showCreditsModal();
  }

  // ◀, ▶ 버튼 및 페이지네이션 도트 클릭 시 넘김 방향 감지, 인덱스 롤링 및 렌더 동기식 수행!
  const prevBtn = e.target.closest('#btn-carousel-prev');
  const nextBtn = e.target.closest('#btn-carousel-next');
  const dotBtn = e.target.closest('.carousel-dot');

  if (prevBtn || nextBtn) {
    const length = state.carouselRecipes.length;
    if (length > 0) {
      state.carouselDirection = prevBtn ? 'left' : 'right';
      const offset = prevBtn ? -1 : 1;
      state.currentCarouselIndex = (state.currentCarouselIndex + offset + length) % length;
      render();
    }
  } else if (dotBtn) {
    const targetIdx = parseInt(dotBtn.dataset.index, 10);
    if (!isNaN(targetIdx)) {
      state.carouselDirection = targetIdx > state.currentCarouselIndex ? 'right' : 'left';
      state.currentCarouselIndex = targetIdx;
      render();
    }
  } else {
    // 일반 라우팅이나 다른 클릭 시에는 초기화
    state.carouselDirection = null;
  }
});

// Mobile Hamburger Toggle
const hamburger = document.getElementById('hamburger');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    const navMenu = document.querySelector('.nav');
    navMenu.classList.toggle('open');
  });
}

// Initial update
updateCarouselRecipes();

// Global Render Manager
export function render() {
  const app = document.getElementById('app');
  if (!app) return;

  let html = '';
  switch (state.route) {
    case 'home':
      html = renderHome();
      break;
    case 'fridge':
      html = renderFridge();
      break;
    case 'recipes':
      html = renderRecipes();
      break;
    case 'mypage':
      html = renderMyPage();
      break;
    case 'detail':
      html = renderDetail(state.currentDetail);
      break;
    case 'cooking':
      html = renderCooking(state.cookingRecipeId);
      break;
    case 'completed':
      html = renderCompleted(state.cookingRecipeId);
      break;
    case 'rating':
      html = renderRating(state.cookingRecipeId);
      break;
    default:
      html = renderHome();
  }

  const isRouteChanged = window.__routingActive;
  window.__routingActive = false; // 플래그 초기화

  app.innerHTML = `<div class="page ${isRouteChanged ? 'route-change-active' : ''}">${html}</div>`;

  // 💥 전체 메뉴 격자판('menu') 모드 복귀 시 동기적 리렌더링 강제 동기화 수행!
  if (state.route === 'recipes' && state.recipeViewMode === 'menu') {
    applyRecipeFilters();
    decorateRecipeCard();
  }
}

/* ==================== 1. HOME SCREEN RENDER ==================== */
function renderHome() {
  return `
    <div class="home-container">
      <div class="home-card">
        <div class="home-hero-wrap">
          <!-- 둥둥 뜨는 토끼 주위에 흩날리는 재료 이모지 데코 -->
          <span class="home-deco-item deco-carrot" aria-hidden="true">🥕</span>
          <span class="home-deco-item deco-egg" aria-hidden="true">🍳</span>
          <span class="home-deco-item deco-tomato" aria-hidden="true">🍅</span>
          <span class="home-deco-item deco-cheese" aria-hidden="true">🧀</span>
          <span class="home-deco-item deco-bread" aria-hidden="true">🍞</span>

          <img src="character.png" alt="귀여운 토끼 요리사 메인 캐릭터" class="home-hero-img" />
        </div>
        <div class="home-title-badge" id="btn-home-badge" style="cursor: pointer;">자취생 맞춤 레시피 </div>
        <h1 class="home-main-title">오늘 냉장고에<br/>뭐가 남아있나요?</h1>
        <p class="home-desc">남은 재료로 맛있고 알뜰하게 요리해보세요.<br/></p>
        <button class="btn btn-primary home-cta-btn" id="btn-start-fridge">시작하기</button>
      </div>
    </div>
  `;
}

/* ==================== 2. MY FRIDGE SCREEN RENDER ==================== */
function renderFridge() {
  const activeCat = state.activeCategory;
  const isOpen = state.isFridgeOpen;

  // Filter ingredients by search AND selected category tab
  let filtered = INGREDIENTS.filter(item => item.name.includes(state.search));
  if (activeCat !== 'all') {
    filtered = filtered.filter(item => item.category === activeCat);
  }

  // Shelf group rendering helper
  function renderShelfItems(shelfItems) {
    if (shelfItems.length === 0) return '';
    return shelfItems.map((ing, idx) => {
      const isSelected = state.selected.has(ing.id);
      const tilt = ((idx % 7) - 3) * 1.5;
      return `
        <div class="ingredient-sticker ${isSelected ? 'selected' : ''}" 
             style="--tilt: ${tilt}deg" 
             data-ing="${ing.id}"
             id="ing-${ing.id}"
             role="checkbox"
             aria-checked="${isSelected}">
          <span class="sticker-chk">✔</span>
          <span class="sticker-emoji">${ing.emoji}</span>
          <span class="sticker-name">${ing.name}</span>
        </div>
      `;
    }).join('');
  }

  // Split ingredients by fridge shelves/drawers naturally
  const shelf1Items = filtered.filter(item => item.category === 'dairy');
  const shelf2Items = filtered.filter(item => item.category === 'grain' || item.category === 'meat');

  // Shelf 3 & Drawer Split for veggies
  const drawerIds = ['cabbage', 'pepper', 'mushroom'];
  const shelf3Items = filtered.filter(item => item.category === 'vegetable' && !drawerIds.includes(item.id));
  const drawerItems = filtered.filter(item => drawerIds.includes(item.id));

  const s1Html = renderShelfItems(shelf1Items) || '<span class="shelf-empty">🥛 비어있음</span>';
  const s2Html = renderShelfItems(shelf2Items) || '<span class="shelf-empty">🍞 비어있음</span>';
  const s3Html = renderShelfItems(shelf3Items) || '<span class="shelf-empty">🥔 비어있음</span>';
  const sDrawerHtml = renderShelfItems(drawerItems) || '<span class="shelf-empty" style="font-size:10px;">비어있음</span>';

  return `
    <div class="fridge-header">
      <h2 class="fridge-title">재료 찾기</h2>
      <p class="fridge-subtitle">냉장고를 열고, 식재료를 꺼내 바구니에 담아봐요!</p>
    </div>
    
    <div class="interactive-fridge-container">
      <div class="interactive-fridge ${isOpen ? "fridge-open" : ""}">
        <div class="fridge-cabinet">
          
          <!-- Freezer Section (stays closed, holds search) -->
          <div class="freezer-section">
            <div class="freezer-door">
              <span class="freezer-brand">FREEZER</span>
              <div class="search-magnet-note">
                <span class="magnet-pin">📌</span>
                <input type="text" id="fridge-search-input" placeholder="재료를 검색하세요!" value="${state.search}" />
              </div>
            </div>
          </div>
          
          <!-- Refrigerator Main Cavity -->
          <div class="fridge-main-section">
            
            <!-- Interior Shelves layout -->
            <div class="fridge-cavity-interior">
              <div class="fridge-shelves-container">
                
                <!-- Shelf 1 -->
                <div class="fridge-shelf-rack" id="shelf-1">
                  <span class="shelf-label">🥛 유제품 & 달걀</span>
                  <div class="shelf-items">${s1Html}</div>
                </div>
                
                <!-- Shelf 2 -->
                <div class="fridge-shelf-rack" id="shelf-2">
                  <span class="shelf-label">🍳 식사 & 고기</span>
                  <div class="shelf-items">${s2Html}</div>
                </div>
                
                <!-- Shelf 3 -->
                <div class="fridge-shelf-rack" id="shelf-3">
                  <span class="shelf-label">🥕 신선 야채</span>
                  <div class="shelf-items">${s3Html}</div>
                </div>
                
              </div>
            </div>
            
            <!-- Bottom Drawer (Veggies) -->
            <div class="fridge-drawer-vegetable">
              <span class="drawer-handle">야채칸 🥬</span>
              <div class="drawer-items">${sDrawerHtml}</div>
            </div>
            
            <!-- 3D Swing Door -->
            <div class="fridge-swing-door" id="interactive-fridge-door">
              <div class="door-front">
                <div class="fridge-handle"></div>
                <div class="click-to-open-sticker">냉장고 문 열기</div>
                <div class="fridge-postits">
                  <div class="postit p1">오늘 요리는? 🥞</div>
                  <div class="postit p2">자취생 편 🌳</div>
                </div>
              </div>
              
              <div class="door-back">
                <div class="door-pocket-title">문 수납공간 (카테고리)</div>
                <div class="door-pockets-wrapper">
                  <div class="door-pocket ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">
                    <span>✨</span> 전체 식재료
                  </div>
                  <div class="door-pocket ${state.activeCategory === "dairy" ? "active" : ""}" data-cat="dairy">
                    <span>🥛</span> 유제품·달걀
                  </div>
                  <div class="door-pocket ${state.activeCategory === "vegetable" ? "active" : ""}" data-cat="vegetable">
                    <span>🥦</span> 채소·과일
                  </div>
                  <div class="door-pocket ${state.activeCategory === "meat" ? "active" : ""}" data-cat="meat">
                    <span>🥓</span> 고기·가공품
                  </div>
                  <div class="door-pocket ${state.activeCategory === "grain" ? "active" : ""}" data-cat="grain">
                    <span>🍞</span> 곡류·식사
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
        <!-- Fridge legs standing on the floor -->
        <div class="fridge-legs-container">
          <div class="fridge-leg-pin"></div>
          <div class="fridge-leg-pin"></div>
        </div>
      </div>

      <!-- 냉장고 우측에서 냉장고를 직시하며 굶주리는 토끼 배치 (업사이징 및 간소화 텍스트) -->
      <div class="fridge-hungry-bunny-wrap">
        <div class="hungry-bubble">
          <span>배고파.. </span>
        </div>
        <img src="hungry.png" class="fridge-hungry-bunny" alt="냉장고 바라보는 배고픈 토끼" />
      </div>
    </div>
    
    <!-- Compact bottom actions instead of full fixed footer -->
    <div class="fridge-bottom-actions">
      <div class="selected-status">
        총 <span>${state.selected.size}</span>개 선택함
      </div>
      <div class="action-buttons">
        <button class="btn btn-outline btn-sm" id="btn-fridge-clear" ${state.selected.size === 0 ? "disabled" : ""}>초기화</button>
        <button class="btn btn-secondary btn-sm" id="btn-suggest-recipes" ${state.selected.size === 0 ? "disabled" : ""}>레시피 추천받기 →</button>
      </div>
    </div>
  `;
}

/* ==================== 3. RECOMMENDED RECIPES SCREEN RENDER ==================== */
function renderRecipes() {
  const recipes = state.carouselRecipes;

  if (recipes.length === 0) {
    return `
      <div class="recipes-container" style="text-align:center; padding: 60px 0;">
        <span style="font-size: 80px; display:block; margin-bottom: 20px;">🤷</span>
        <h2 class="fridge-title">아직 재료가 없어요</h2>
        <p class="fridge-subtitle" style="margin-bottom: 20px;">재료를 하나 이상 골라야 요리를 할 수 있답니다.</p>
        <button class="btn btn-primary" data-nav="fridge">식재료 고르러 가기 🧺</button>
      </div>
    `;
  }

  const currentIdx = state.currentCarouselIndex;
  const currentRecipe = recipes[currentIdx];
  const isFav = state.favorites.has(currentRecipe.id);

  const dislikeText = state.showingAlternatives
    ? '원래 요리 추천 보기'
    : '마음에 드는게 없어요';

  const titleText = state.showingAlternatives
    ? "편의점 꿀조합"
    : "맞춤 추천 요리";

  const subtitleText = state.showingAlternatives
    ? '냉장고에 재료가 부족할 땐 편의점 꿀조합 레시피는 어때요?'
    : '가지고 있는 재료로 만들 수 있는 추천 요리입니다!';

  // Render dots indicators
  const dotsHtml = recipes.map((_, idx) => `
    <span class="carousel-dot ${idx === currentIdx ? 'active' : ''}" data-index="${idx}"></span>
  `).join('');

  const missingHtml = renderMissingIngredientsGuidance(currentRecipe);


  return `
    <div class="recipes-container">
      <div class="fridge-header">
        <h2 class="fridge-title">${titleText}</h2>
        <p class="fridge-subtitle">${subtitleText}</p>
      </div>
      
      <!-- Slider Carousel -->
      <div class="carousel-wrapper">
        <!-- Alternative dislike action sticker -->
        <button class="recipe-dislike-btn" id="btn-dislike-recipe">${dislikeText}</button>
        
        <button class="carousel-btn carousel-btn-prev" id="btn-carousel-prev" aria-label="이전 레시피">◀</button>
        
        <div class="carousel-track">
          <div class="recipe-card-box ${state.carouselDirection ? 'slide-in-' + state.carouselDirection : ''}">
            <div class="recipe-card-header">
              ${currentRecipe.emoji}
              <button class="recipe-fav-toggle ${isFav ? 'active' : ''}" data-recipe-id="${currentRecipe.id}" aria-label="즐겨찾기">
                ${isFav ? '❤️' : '🤍'}
              </button>
            </div>
            <div class="recipe-card-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 class="recipe-card-title">${currentRecipe.name}</h3>
                <span class="recipe-meta-tag match-tag">매치율 ${currentRecipe.rate}%</span>
              </div>
              
              <div class="recipe-meta-tags">
                <span class="recipe-meta-tag">⭐ ${currentRecipe.difficulty}</span>
                <span class="recipe-meta-tag">⏱️ ${currentRecipe.time}</span>
              </div>
              
              ${missingHtml}
              
              <div class="recipe-action">
                <button class="btn btn-primary recipe-detail-btn" id="btn-view-steps" data-rid="${currentRecipe.id}">
                  ${currentRecipe.id.startsWith('alt') ? '영수증 보기' : '레시피 보기'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <button class="carousel-btn carousel-btn-next" id="btn-carousel-next" aria-label="다음 레시피">▶</button>
      </div>
      
      <div class="carousel-dots">
        ${dotsHtml}
      </div>
      <p style="font-size: 13px; font-weight: 800; margin-top: 10px; color: var(--color-gray); background-color: var(--color-gray-light); padding: 4px 12px; border-radius: 99px;">
        ${currentIdx + 1} / ${recipes.length}
      </p>
    </div>
  `;
}

function escapeHtmlForUi(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMissingIngredientsGuidance(recipe) {
  const missing = Array.isArray(recipe?.missing) ? recipe.missing : [];
  const tips = normalizeSubstituteTips(recipe);
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const applicableTips = tips.filter((tip) =>
    missing.some((ingredient) => normalize(ingredient) === normalize(tip.original))
  );
  const substituteOriginals = new Set(applicableTips.map((tip) => normalize(tip.original)));
  const unresolved = missing.filter((ingredient) => !substituteOriginals.has(normalize(ingredient)));

  if (missing.length === 0) {
    return `
      <div class="recipe-missing-box" style="border-color: var(--color-mint); border-left-color: var(--color-mint); background-color: var(--color-mint-light);">
        <div class="recipe-missing-title" style="color: var(--color-mint-deep)">✨ 완벽해요!</div>
        <div class="recipe-missing-items" style="color: var(--color-mint-deep)">필요한 재료가 모두 준비되어 있어요!</div>
      </div>
    `;
  }

  if (applicableTips.length > 0) {
    const substitutions = applicableTips.map((tip) =>
      `${escapeHtmlForUi(tip.original)} 대신 ${tip.alternatives.map(escapeHtmlForUi).join(', ')}를 사용해보세요.`
    );
    if (unresolved.length > 0) {
      substitutions.push(`여전히 필요한 재료: ${unresolved.map(escapeHtmlForUi).join(', ')}`);
    }
    return `
      <div class="recipe-missing-box">
        <div class="recipe-missing-title">💡 대체 재료로 만들 수 있어요!</div>
        <div class="recipe-missing-items">${substitutions.join('<br>')}</div>
      </div>
    `;
  }

  return `
    <div class="recipe-missing-box">
      <div class="recipe-missing-title">🛒 재료가 조금 부족해요!</div>
      <div class="recipe-missing-items">${missing.map(escapeHtmlForUi).join(', ')}</div>
    </div>
  `;
}

/* ==================== 4. RECIPE DETAIL SCREEN RENDER ==================== */
function renderDetail(id) {
  // Find in normal recipes or alternatives
  let recipe = RECIPES.find(r => r.id === id);
  let isAlt = false;

  if (!recipe) {
    recipe = ALTERNATIVE_RECIPES.find(r => r.id === id);
    isAlt = true;
  }

  if (!recipe) return `<p style="text-align:center; padding: 40px;">레시피 정보가 올바르지 않아요.</p>`;

  // Dynamic back button text based on tracking state
  const backLabel = state.detailBackRoute === 'mypage'
    ? '◀ 마이페이지'
    : state.detailBackRecipeView === 'carousel'
      ? '◀ 추천 캐러셀'
      : '◀ 레시피';

  const substituteTipsHtml = renderSubstituteTips(recipe);

  // Draw Grocery Receipt for convenience store combo
  if (isAlt) {
    const formattedDate = new Date().toLocaleString('ko-KR', { hour12: false });
    const itemsHtml = recipe.priceList.map(item => `
      <div class="receipt-row">
        <span>${item.name}</span>
        <span>1개</span>
        <span>${item.price.toLocaleString()}원</span>
      </div>
    `).join('');

    return `
      <div class="detail-container">
        <div class="btn-back-wrap">
          <button class="btn btn-outline btn-sm" id="btn-detail-back">${backLabel}</button>
        </div>
        
        <!-- Convenience Store Receipt Card layout -->
        <div class="receipt-paper">
          <div class="receipt-header">
            <div class="receipt-store-logo">편의점 고인물의 꿀팁</div>
            <div class="receipt-title">장바구니 영수증</div>
            <div class="receipt-date">ISSUED: ${formattedDate}</div>
            <div class="receipt-divider">================================</div>
          </div>
          
          <div class="receipt-body">
            <div class="receipt-table-header">
              <span>상품명</span>
              <span>수량</span>
              <span>단가</span>
            </div>
            <div class="receipt-divider">--------------------------------</div>
            ${itemsHtml}
            <div class="receipt-divider">================================</div>
            <div class="receipt-total-row">
              <span>합계 금액 (Total)</span>
              <strong>${recipe.totalPrice.toLocaleString()}원</strong>
            </div>
          </div>
          
          <div class="receipt-tips">
            <h4 class="tips-title">💡 꿀조합 초간단 조리 팁</h4>
            <ol class="tips-list">
              ${recipe.steps.map((step, idx) => `<li>${idx + 1}. ${step}</li>`).join('')}
            </ol>
          </div>
          
          <div class="receipt-barcode-box">
            <div class="receipt-barcode"></div>
            <div class="receipt-barcode-num">* CS-${recipe.id.toUpperCase()} *</div>
          </div>
        </div>
        
        ${substituteTipsHtml}
        <div class="detail-actions-tray" style="margin-top:20px; display:flex; justify-content:center;">
          <button class="btn btn-primary" id="btn-start-cooking" data-recipe-id="${recipe.id}" style="flex: none; max-width: 280px; width: 100%;">
            이 조합 조리 시작! 💸
          </button>
        </div>
      </div>
    `;
  }

  // Calculate matching stats
  const total = (recipe.need || []).length;
  const missing = calculateMissingIngredients(recipe);
  const matched = (recipe.need || []).filter(id => state.selected.has(id)).length;
  const rate = total === 0 ? 0 : Math.round((matched / total) * 100);

  const isFav = state.favorites.has(recipe.id);

  // Missing ingreds
  const missingLabel = missing.length > 0
    ? missing.join(', ')
    : '부족한 재료 없음';

  return `
    <div class="detail-container">
      <div class="btn-back-wrap">
        <button class="btn btn-outline btn-sm" id="btn-detail-back">${backLabel}</button>
      </div>
      
      <!-- Open Notebook Container -->
      <div class="notebook-book">
        
        <!-- Left half: Summary Stick -->
        <div class="notebook-left-page">
          <div class="notebook-sticker-frame">
            ${recipe.emoji}
          </div>
          <h2 class="notebook-recipe-title">${recipe.name}</h2>
          <div class="notebook-detail-meta">
            <span class="recipe-meta-tag">난이도: ${recipe.difficulty}</span>
            <span class="recipe-meta-tag">시간: ${recipe.time}</span>
          </div>
          
          <div class="notebook-ai-reason">
            ${recipe.aiReason}
          </div>
        </div>
        
        <!-- Right half: Ruled Notebook Paper -->
        <div class="notebook-right-page">
          <!-- Ingredients Memo Pad -->
          <div class="notebook-notepad">
            <h4 class="notepad-title">🧂 필요 재료</h4>
            <ul class="notepad-list">
              ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
            </ul>
             <div style="font-family: var(--font-hand); font-size:15px; color: var(--color-orange-deep); margin-top: 10px; border-top:1px dashed var(--color-cream-dark); padding-top:6px; display:flex; justify-content:space-between; align-items:center;">
               <span>🚨 <b>냉장고에 없는 재료:</b> ${missingLabel}</span>
               <button class="btn btn-secondary btn-sm" id="btn-view-shopping" style="padding: 4px 10px !important; font-size:12px !important; margin-left:10px;">장바구니</button>
             </div>
          </div>
          
          ${substituteTipsHtml}
          <!-- Steps Memo Pad -->
          <div class="notebook-notepad">
            <h4 class="notepad-title">👩🍳 주방 순서</h4>
            <ol class="notepad-steps">
              ${recipe.steps.map((step, idx) => `
                <li data-step="${idx + 1}">${step}</li>
              `).join('')}
            </ol>
          </div>
          
          <div class="detail-actions-tray">
            <button class="btn btn-outline" id="btn-detail-fav-toggle" data-recipe-id="${recipe.id}">
              ${isFav ? '❤️ 즐겨찾기 해제' : '🤍 즐겨찾기 저장'}
            </button>
            <button class="btn btn-primary" id="btn-start-cooking" data-recipe-id="${recipe.id}">요리 시작하기</button>
          </div>
        </div>
        
      </div>
    </div>
  `;
}

/* ==================== 5. COOKING SCREEN ANIMATION RENDER ==================== */
function renderCooking(id) {
  let recipe = RECIPES.find(r => r.id === id);
  if (!recipe) recipe = ALTERNATIVE_RECIPES.find(r => r.id === id);
  const name = recipe ? recipe.name : '요리';

  // Custom ingredients rising for sequence. Alternates or shows based on recipe
  const seq = (recipe && recipe.cookingSequence) || ['🥔', '🔪', '🍳', '✨'];

  return `
    <div class="cooking-container">
      <div class="cooking-box">
        <div class="cooking-animation-area">
          <div class="cooking-item-pan">🍳</div>
          
          <span class="cooking-bubble-particle" style="--x-offset: -50px; animation-duration: 2.2s; animation-delay: 0s;">${seq[0] || '🥔'}</span>
          <span class="cooking-bubble-particle" style="--x-offset: 40px; animation-duration: 1.8s; animation-delay: 0.4s;">${seq[1] || '🔪'}</span>
          <span class="cooking-bubble-particle" style="--x-offset: -10px; animation-duration: 2s; animation-delay: 0.8s;">${seq[2] || '🍳'}</span>
          <span class="cooking-bubble-particle" style="--x-offset: 50px; animation-duration: 1.5s; animation-delay: 1.2s;">${seq[3] || '✨'}</span>
        </div>
        <h2 class="cooking-title">${name} 만드는 중...</h2>
        <p class="cooking-desc">${name}을(를) 맛있게 조리하고 있어요 😋</p>
        
        <div class="cooking-progress-bar">
          <div class="cooking-progress-fill"></div>
        </div>
      </div>
    </div>
  `;
}

// Timer management to fill progress bar and auto navigate
export function startCookingFlow(recipeId) {
  clearCookingFlowTimers();
  let progress = 0;
  const fillElement = document.querySelector('.cooking-progress-fill');

  cookingIntervalId = setInterval(() => {
    progress += 4;
    if (fillElement) {
      fillElement.style.width = `${Math.min(progress, 100)}%`;
    }

    if (progress >= 100) {
      clearInterval(cookingIntervalId);
      cookingIntervalId = null;
      // Wait another 300ms for graphical polish, then push to completed
      cookingTimeoutId = setTimeout(() => {
        cookingTimeoutId = null;
        navigate('completed', recipeId);
      }, 350);
    }
  }, 100);
}

// Timer clear helper
function clearCookingFlowTimers() {
  if (cookingIntervalId !== null) {
    clearInterval(cookingIntervalId);
    cookingIntervalId = null;
  }
  if (cookingTimeoutId !== null) {
    clearTimeout(cookingTimeoutId);
    cookingTimeoutId = null;
  }
}

/* ==================== 6. COMPLETED SCREEN RENDER ==================== */
function renderCompleted(id) {
  let recipe = RECIPES.find(r => r.id === id);
  if (!recipe) recipe = ALTERNATIVE_RECIPES.find(r => r.id === id);
  if (!recipe) return '<p>요리 완료 중 이상이 생겼어요.</p>';

  // Find which ingredients from selections were matching/used
  const usedIngredients = recipe.need
    .filter(iId => state.selected.has(iId))
    .map(iId => INGREDIENTS.find(i => i.id === iId))
    .filter(Boolean);

  let usedHtml = '';
  if (usedIngredients.length > 0) {
    usedHtml = usedIngredients.map(item => `
      <span class="completed-ing-sticker">${item.emoji} ${item.name}</span>
    `).join('');
  } else {
    // default elements if no selection match
    usedHtml = recipe.need
      .map(iId => INGREDIENTS.find(i => i.id === iId))
      .filter(Boolean)
      .map(item => `
        <span class="completed-ing-sticker">${item.emoji} ${item.name}</span>
      `).join('');
  }

  return `
    <div class="completed-container">
      <div class="completed-card">
        <div class="completed-celebration-emoji">
          ${recipe.emoji}
        </div>
        <h2 class="completed-title">맛있게 완성했어요! 🎉</h2>
        <div class="completed-dish-name">🤤 ${recipe.name}</div>
        
        <p class="completed-ingredients-label">🍳 요리에 들어간 재료들</p>
        <div class="completed-ingredients-list">
          ${usedHtml}
        </div>
        
        <button class="btn btn-primary completed-action-btn" id="btn-go-rating" data-recipe-id="${recipe.id}">후기 남기기</button>
      </div>
    </div>
  `;
}

// Spawns confetti divs programmatically
export function spawnConfetti() {
  const container = document.querySelector('.completed-container');
  if (!container) return;

  const colors = ['#FF7A5A', '#78C0A8', '#FFD15C', '#84B3FF', '#FF84DF', '#A2D2FF'];
  for (let i = 0; i < 28; i++) {
    const chip = document.createElement('div');
    chip.className = 'confetti-particle';
    chip.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    chip.style.left = Math.random() * 100 + '%';
    chip.style.top = '-10px';
    chip.style.width = Math.floor(Math.random() * 8) + 6 + 'px';
    chip.style.height = chip.style.width;
    chip.style.setProperty('--fall-x', (Math.random() * 200 - 100) + 'px');
    chip.style.animationDelay = (Math.random() * 1.5).toFixed(2) + 's';
    chip.style.animationDuration = (Math.random() * 1.5 + 2).toFixed(2) + 's';
    container.appendChild(chip);
  }
}

/* ==================== 8. 통합 마이페이지 (MY PAGE) VIEW RENDER ==================== */
function renderMyPage() {
  const all = [...RECIPES, ...ALTERNATIVE_RECIPES];
  const cookedCount = all.filter(r => (state.cookedCounts[r.id] || 0) > 0).length;
  const totalRecipes = all.length;
  const percent = Math.round((cookedCount / totalRecipes) * 100);

  // Favorites (찜한 레시피)
  const favRecipes = all.filter(r => state.favorites.has(r.id));

  // localStorage의 최근 찜한 시간(favoriteAddedAt) 기준으로 내림차순 정렬 연동
  try {
    const addedAtMap = JSON.parse(localStorage.getItem('favoriteAddedAt') || '{}');
    favRecipes.sort((a, b) => {
      const timeA = addedAtMap[a.id] ? new Date(addedAtMap[a.id]).getTime() : 0;
      const timeB = addedAtMap[b.id] ? new Date(addedAtMap[b.id]).getTime() : 0;
      return timeB - timeA; // 최신 찜한 시간이 더 큰 타임스탬프를 가짐 -> 내림차순 정렬
    });
  } catch (e) {
    console.warn("localStorage 'favoriteAddedAt' 파싱 에러 발생:", e);
  }

  const favsHtml = favRecipes.length > 0
    ? favRecipes.map(r => {
      const isCooked = (state.cookedCounts[r.id] || 0) > 0;
      return `
          <div class="book-recipe-card ${isCooked ? 'discovered' : 'undiscovered'}" data-rid="${r.id}">
            <div class="book-card-emoji">${r.emoji}</div>
            <div class="book-card-name">${r.name}</div>
          </div>
        `;
    }).join('')
    : `<div class="book-empty-text" style="grid-column: 1/-1; text-align:center; padding: 20px; font-family: var(--font-hand); color: var(--color-gray);">아직 찜한 요리가 없어요. 레시피 상세 카드에서 하트를 눌러 찜해보세요!</div>`;

  // Collection 필터링 처리 (전체 / 쉬움 / 보통 / 어려움 / 편의점)
  const filterVal = state.mypageDifficultyFilter;
  let filteredAll = all;
  if (filterVal === '편의점') {
    // ID가 alt로 시작하는 편의점 꿀조합만 필터링
    filteredAll = all.filter(r => r.id.startsWith('alt'));
  } else if (filterVal !== 'all') {
    filteredAll = all.filter(r => r.difficulty === filterVal);
  }

  // Collection (도감 리스트 렌더링)
  const collectionHtml = filteredAll.map(r => {
    const count = state.cookedCounts[r.id] || 0;
    const isCooked = count > 0;

    if (isCooked) {
      const typeLabel = r.id.startsWith('alt') ? '편의점' : '일반';
      const badgeClass = r.id.startsWith('alt') ? 'badge-alt' : 'badge-normal';
      return `
        <div class="book-recipe-card discovered" data-rid="${r.id}">
          <span class="book-badge ${badgeClass}">${typeLabel}</span>
          <div class="book-card-emoji">${r.emoji}</div>
          <div class="book-card-name">${r.name}</div>
          <div class="book-card-count">${count}회 조리</div>
        </div>
      `;
    } else {
      // Locked item with ingredient hints!
      const hints = r.need.map(id => {
        const ing = INGREDIENTS.find(i => i.id === id);
        return ing ? ing.emoji : '';
      }).join(' ');

      return `
        <div class="book-recipe-card undiscovered">
          <span class="book-badge badge-locked">🔒 잠금</span>
          <div class="book-card-emoji">❓</div>
          <div class="book-card-name">???</div>
          <div class="book-card-hint">필요: ${hints}</div>
        </div>
      `;
    }
  }).join('');

  // 필터링 결과가 비어있을 때 안내 문구
  const finalCollectionHtml = collectionHtml || `<div class="book-empty-text" style="grid-column: 1/-1; text-align:center; padding: 30px 20px; font-family: var(--font-hand); color: var(--color-gray);">해당 난이도("${filterVal}") 조건의 요리 카드가 존재하지 않습니다.</div>`;

  return `
    <div class="mypage-container" style="display: flex; flex-direction: column; gap: 35px; width: 100%;">
      <div class="fridge-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 15px;">
        <div>
          <h2 class="fridge-title">마이페이지</h2>
          <p class="fridge-subtitle">찜 레시피와 요리 도감을 관리해요!</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-open-shopping" style="padding: 8px 16px !important; font-size: 14px !important; display: flex; align-items: center; gap: 6px;">
          장바구니
        </button>
      </div>

      <!-- 1. 찜한 레시피 섹션 -->
      <div class="mypage-section" style="background-color: var(--color-white); border: var(--border-thick); border-radius: var(--br-lg); padding: 25px 20px; box-shadow: 0 6px 0 var(--color-shadow);">
        <h3 class="book-section-title" style="margin-top:0; border-bottom: 2px dashed var(--color-cream-dark); padding-bottom: 8px;">❤️ 내가 찜한 요리</h3>
        <div class="book-favorites-grid" style="margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px;">
          ${favsHtml}
        </div>
      </div>

      <!-- 2. 요리 도감 섹션 -->
      <div class="mypage-section" style="background-color: var(--color-white); border: var(--border-thick); border-radius: var(--br-lg); padding: 25px 20px; box-shadow: 0 6px 0 var(--color-shadow);">
        <h3 class="book-section-title" style="margin-top:0; border-bottom: 2px dashed var(--color-cream-dark); padding-bottom: 8px;">📖 요리 도감</h3>
        
        <div class="book-progress-wrapper" style="margin: 15px 0 20px 0; background: var(--color-cream-light); border: var(--border-thin); border-radius: var(--br-sm); padding: 15px;">
          <div class="book-progress-text" style="display:flex; justify-content:space-between; font-weight:800; font-size:14px; margin-bottom:8px;">
            <span>전체 도감 완성률</span>
            <strong>${cookedCount} / ${totalRecipes} (${percent}%)</strong>
          </div>
          <div class="book-progress-bar-bg" style="background-color: var(--color-white); border: var(--border-thin); border-radius: 99px; height: 16px; overflow: hidden; position: relative;">
            <div class="book-progress-bar-fill" style="width: ${percent}%; background-color: var(--color-mint); height: 100%; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <!-- 난이도 필터 메뉴 칩 버튼 그룹 -->
        <div class="difficulty-filter-container" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:20px; flex-wrap:wrap; font-family: var(--font-main);">
          <button class="chip-btn ${state.mypageDifficultyFilter === "all" ? "active" : ""}" data-diff="all" style="font-size:12px; padding: 5px 14px;">전체</button>
          <button class="chip-btn ${state.mypageDifficultyFilter === "쉬움" ? "active" : ""}" data-diff="쉬움" style="font-size:12px; padding: 5px 14px;">🟢 쉬움</button>
          <button class="chip-btn ${state.mypageDifficultyFilter === "보통" ? "active" : ""}" data-diff="보통" style="font-size:12px; padding: 5px 14px;">🟡 보통</button>
          <button class="chip-btn ${state.mypageDifficultyFilter === "어려움" ? "active" : ""}" data-diff="어려움" style="font-size:12px; padding: 5px 14px;">🔴 어려움</button>
          <button class="chip-btn ${state.mypageDifficultyFilter === "편의점" ? "active" : ""}" data-diff="편의점" style="font-size:12px; padding: 5px 14px;">🏪 편의점</button>
        </div>

        <div class="book-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px;">
          ${finalCollectionHtml}
        </div>
      </div>
    </div>
  `;
}

/* ==================== 7. RATING SCREEN RENDER ==================== */
function renderRating(id) {
  let recipe = RECIPES.find(r => r.id === id);
  if (!recipe) recipe = ALTERNATIVE_RECIPES.find(r => r.id === id);
  const dishName = recipe ? recipe.name : '이 요리';

  return `
    <div class="rating-container">
      <div class="dialogue-section">
        <!-- 멘붕 탄 토끼로 뽀짝하게 대체 -->
        <div class="rating-mascot-wrap">
          <img src="burned.png" class="rating-mascot-img" alt="멘붕 토끼" />
        </div>
        <div class="speech-bubble">
          <div class="speech-bubble-text">
            방금 드신 <b>${dishName}</b>,<br/>
            다시 만들어 먹고 싶나요?
          </div>
          <span class="speech-arrow">▼</span>
        </div>
      </div>
      
      <!-- Selection Buttons -->
      <div class="rating-options">
        <button class="rating-option-btn ${state.ratingFeedback === 'best' ? 'selected' : ''}" data-choice="best">
          <span>😍 또 먹고 싶어요!</span>
          <span class="rating-option-emoji"></span>
        </button>
        <button class="rating-option-btn ${state.ratingFeedback === 'ok' ? 'selected' : ''}" data-choice="ok">
          <span>🙂 괜찮았어요.</span>
          <span class="rating-option-emoji"></span>
        </button>
        <button class="rating-option-btn ${state.ratingFeedback === 'no' ? 'selected' : ''}" data-choice="no">
          <span>😅 다른 요리를 먹어볼래요.</span>
          <span class="rating-option-emoji"></span>
        </button>
      </div>
      
      <div class="rating-action-shelf">
        <button class="btn btn-secondary" id="btn-rate-book" data-nav="mypage">요리 도감</button>
        <button class="btn btn-primary" id="btn-rate-home" data-nav="home">홈으로</button>
      </div>
    </div>
  `;
}

// Bootstrapping the page loader
document.addEventListener('DOMContentLoaded', () => {
  navigate('home');
});

/* ==================== 🐰 DEVELOPER CREDITS EASTER EGG MODAL ==================== */
export function showCreditsModal() {
  let modal = document.getElementById('credits-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'credits-modal';
    modal.className = 'custom-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="custom-modal-content credit-card-content" style="
      max-width: 450px; 
      width: 90%; 
      padding: 35px 30px; 
      border: 3px solid var(--color-charcoal); 
      border-radius: var(--br-lg); 
      box-shadow: 0 8px 0 var(--color-shadow); 
      text-align: center; 
      position: relative; 
      background: #fffdf9;
    ">
      <!-- 우측 상단 x 닫기 버튼 -->
      <button class="modal-close" onclick="document.getElementById('credits-modal').classList.remove('show')" style="
        position: absolute; 
        right: 15px; 
        top: 12px; 
        background: none; 
        border: none; 
        font-size: 18px; 
        font-weight: bold; 
        cursor: pointer; 
        color: var(--color-charcoal);
      ">✖</button>
      
      <!-- 🍔 비밀 요리 본부 타이틀 -->
      <h3 class="modal-title" style="
        font-size: 24px; 
        font-weight: 850; 
        color: var(--color-orange-deep); 
        margin: 0 0 24px 0; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 8px; 
        font-family: var(--font-main);
      ">
        <span style="font-size: 26px;"></span> 비밀 요리 본부
      </h3>
      
      <!-- 개발 | 파이브가이즈 🍔🍟 알약 카드 박스 -->
      <div class="credit-list" style="
        text-align: center; 
        background: var(--color-cream-light); 
        border: 2px solid var(--color-charcoal); 
        border-radius: 99px; 
        padding: 16px 20px; 
        font-family: var(--font-hand); 
        font-size: 21px; 
        color: var(--color-charcoal); 
        display: inline-flex; 
        align-items: center; 
        justify-content: center; 
        gap: 8px; 
        font-weight: 800; 
        box-shadow: inset 1px 2px 0 rgba(0,0,0,0.03);
        width: 100%;
        box-sizing: border-box;
      ">
        개발 | 파이브가이즈 <span style="font-size: 23px; display:inline-flex; gap:2px;">🍔🍟</span>
      </div>
    </div>
  `;

  modal.offsetHeight;
  modal.classList.add('show');
}

// 기능별 모듈 초기화 실행 (순환 참조 방지를 위해 비동기 동적 임포트 사용)
Promise.all([
  import('./ingredient.js'),
  import('./recommend.js'),
  import('./recipe.js'),
  import('./favorite.js'),
  import('./shopping.js')
]).then(([
  ingredientMod,
  recommendMod,
  recipeMod,
  favoriteMod,
  shoppingMod
]) => {
  normalizeSubstituteTips = recipeMod.normalizeSubstituteTips || (() => []);
  renderSubstituteTips = recipeMod.renderSubstituteTips || (() => '');
  ingredientMod.initIngredient();
  recommendMod.initRecommend();
  recipeMod.initRecipe();
  favoriteMod.initFavorite();
  shoppingMod.initShopping();
});
