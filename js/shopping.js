//------------------------------------
// 담당 : 형묵
// 수정 가능
//------------------------------------
/* 장보기 기능 모듈 */

export function initShopping() {
  document.addEventListener('click', (event) => {
    // 장바구니 모달 열기
    const openBtn = event.target.closest('#btn-open-shopping');
    if (openBtn) {
      const modal = document.getElementById('shopping-modal');
      if (modal) modal.classList.add('show');
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

    item.classList.toggle('checked');
    const isChecked = item.classList.contains('checked');
    item.setAttribute('aria-checked', String(isChecked));

    // 체크 상태에 따라 체크박스 기호 실시간 변경 (☐ ↔ ☑)
    const chkBox = item.querySelector('.chk-box');
    if (chkBox) {
      chkBox.textContent = isChecked ? '☑' : '☐';
    }
  });
}


