//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 장보기 기능 모듈 */

const SHOPPING_STORAGE_KEY = 'shoppingList';

export function normalizeIngredientName(name) {
  return String(name || '').trim().toLowerCase();
}

function getSourceKey(source) {
  return `${source.recipeId || ''}-${normalizeIngredientName(source.ingredientName)}`;
}

export function normalizeShoppingItems(items) {
  const merged = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const ingredientName = String(item.ingredientName || item.ingredientKey || '').trim();
    const ingredientKey = normalizeIngredientName(ingredientName);
    if (!ingredientKey) return;

    let group = merged.get(ingredientKey);
    if (!group) {
      group = {
        ingredientKey,
        ingredientName,
        completed: Boolean(item.completed),
        sources: []
      };
      merged.set(ingredientKey, group);
    } else {
      group.completed = group.completed || Boolean(item.completed);
    }

    const sources = Array.isArray(item.sources)
      ? item.sources
      : [item];

    sources.forEach((source) => {
      if (!source || typeof source !== 'object') return;
      const normalizedSource = {
        recipeId: source.recipeId || '',
        recipeName: source.recipeName || '',
        amount: source.amount || '약간',
        addedAt: source.addedAt || ''
      };
      if (!group.sources.some((saved) => getSourceKey({
        recipeId: saved.recipeId,
        ingredientName: ingredientKey
      }) === getSourceKey({
        recipeId: normalizedSource.recipeId,
        ingredientName: ingredientKey
      }))) {
        group.sources.push(normalizedSource);
      }
    });
  });

  return [...merged.values()];
}

export function getShoppingItems() {
  try {
    const items = JSON.parse(localStorage.getItem(SHOPPING_STORAGE_KEY) || '[]');
    return normalizeShoppingItems(items);
  } catch {
    return [];
  }
}

export function saveShoppingItems(items) {
  const normalizedItems = normalizeShoppingItems(items);
  localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(normalizedItems));
  return normalizedItems;
}

export function addShoppingItems(items) {
  const currentItems = getShoppingItems();
  const savedKeys = new Set(currentItems.flatMap((item) => item.sources.map((source) =>
    getSourceKey({ recipeId: source.recipeId, ingredientName: item.ingredientKey })
  )));
  const addedItems = (Array.isArray(items) ? items : []).filter((item) => {
    const ingredientName = String(item?.ingredientName || '').trim();
    const key = getSourceKey({ recipeId: item?.recipeId, ingredientName });
    if (!ingredientName || savedKeys.has(key)) return false;
    savedKeys.add(key);
    return true;
  });

  saveShoppingItems([...currentItems, ...addedItems]);
  return addedItems;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderShoppingList() {
  const list = document.querySelector('.shopping-checklist');
  if (!list) return;

  const items = getShoppingItems();
  saveShoppingItems(items);
  list.innerHTML = items.length > 0
    ? items.map((item) => `
        <li class="shopping-item ${item.completed ? 'checked' : ''}"
            data-shopping-item="${encodeURIComponent(item.ingredientKey)}"
            aria-checked="${String(item.completed)}">
          <span class="chk-box">${item.completed ? '☑' : '☐'}</span>
          <span class="item-name">
            ${escapeHtml(item.ingredientName)}
            ${item.sources.map((source) => `<br><small>- ${escapeHtml(source.recipeName)}: ${escapeHtml(source.amount)}</small>`).join('')}
          </span>
        </li>
      `).join('')
    : '<li class="shopping-item-empty" style="text-align:center; padding: 25px 0; color: var(--color-gray); font-family: var(--font-hand); font-size: 17px; list-style: none;">아직 장보기 리스트가 비어 있어요.</li>';
}

export function toggleShoppingItemCompleted(ingredientKey) {
  const key = normalizeIngredientName(ingredientKey);
  const items = getShoppingItems();
  const item = items.find((saved) => saved.ingredientKey === key);
  if (!item) return;

  item.completed = !item.completed;
  saveShoppingItems(items);
  renderShoppingList();
}

export function initShopping() {
  document.addEventListener('click', (event) => {
    // 장바구니 모달 열기
    const openBtn = event.target.closest('#btn-open-shopping');
    if (openBtn) {
      const modal = document.getElementById('shopping-modal');
      if (modal) modal.classList.add('show');
      renderShoppingList();
      return;
    }

    // 장바구니 모달 닫기
    const closeBtn = event.target.closest('#btn-shopping-modal-close');
    const doneBtn = event.target.closest('#btn-shopping-modal-done');
    if (closeBtn || doneBtn) {
      const modal = document.getElementById('shopping-modal');
      if (modal) modal.classList.remove('show');
      return;
    }

    const item = event.target.closest('[data-shopping-item]');
    if (!item) return;

    toggleShoppingItemCompleted(decodeURIComponent(item.dataset.shoppingItem));
  });
}


