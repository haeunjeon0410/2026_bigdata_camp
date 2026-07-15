//------------------------------------
// 담당 : 지호
// 수정 가능
//------------------------------------
/* 추천 기능 모듈 */

import { state, showToast, render, navigate, updateCarouselRecipes } from './app.js';
import { RECIPES, ALTERNATIVE_RECIPES } from './data.js';

// 추천 화면에서만 사용하는 취향 상태입니다. app.js의 state 구조는 변경하지 않습니다.
const selectedPreferences = new Set();
const selectedCuisines = new Set();
let recipeSearchQuery = '';
let recipePage = 1;
let isSearchComposing = false;
let searchRefreshTimer = null;
let activeDifficultyFilter = 'all';
let lastRecipeViewMode = null;
const recipeInsightState = {
  recipeId: null,
  status: 'idle'
};

const recipeInsightPresets = {
  순두부찌개: {
    cost: '약 2,900원',
    costBasis: '1인분 · 기본 양념과 식용유 사용분 포함',
    storage: [
      ['순두부', '개봉 후 1~2일'],
      ['계란', '냉장 2~3주'],
      ['대파', '냉장 5~7일'],
      ['다진 마늘', '냉장 3~5일']
    ],
    note: '제품 포장 소비기한과 개봉일을 우선 확인하세요. 아래 값은 보수적으로 잡은 참고용 추정치입니다.'
  }
};

export function hasActiveRecipeFilters() {
  return selectedCuisines.size > 0
    || activeDifficultyFilter !== 'all'
    || Boolean(recipeSearchQuery.trim());
}

const cuisineKeywords = {
  한식: ['김치', '비빔', '찌개', '국', '탕', '불고기', '잡채', '김밥', '된장', '감자볶음', '계란말이', '볶음', '반찬'],
  양식: ['파스타', '토스트', '샌드위치', '피자', '스테이크', '샐러드', '팬케이크', '오믈렛', '그라탕', '리조또', '치즈'],
  일식: ['돈부리', '규동', '우동', '오니기리', '초밥', '카레', '타코야키', '가츠', '덮밥'],
  중식: ['짜장', '짬뽕', '마파', '탕수육', '깐풍', '유산슬', '춘권', '만두']
};

const cuisineOverrides = {
  '알리오 올리오': '양식',
  샌드위치: '양식',
  토스트: '양식',
  오므라이스: '일식',
  볶음우동: '일식',
  햄야채볶음: '한식',
  계란국: '한식',
  덮밥: '한식',
  돼지고기덮밥: '한식',
  '돼지고기 덮밥': '한식',
  짜장면: '중식',
  짬뽕: '중식',
  탕수육: '중식'
};

const seasoningTips = {
  감자전: '반죽에는 소금 1/3작은술만 넣습니다. 찍어 먹는 양념장은 진간장 1큰술·식초 1/2큰술·물 1/2큰술을 섞고, 싱거우면 간장 1/2작은술씩 보충하세요.',
  볶음밥: '밥 1공기 기준 진간장 1큰술을 팬 가장자리에 둘러 향을 내고, 볶은 뒤 싱거우면 소금 1꼬집씩 추가합니다. 굴소스를 사용할 때는 1/2큰술만 넣고 간장은 1/2큰술로 줄이세요.',
  오므라이스: '볶음밥에는 케첩 2큰술과 소금 1/4작은술을 넣고, 계란물에는 소금 1꼬집만 넣습니다. 완성 후 싱거우면 케첩 1작은술을 곁들이고 소금을 추가하지 마세요.',
  덮밥: '돼지고기 150g 기준 진간장 1큰술·굴소스 1/2큰술·설탕 1/2큰술을 먼저 졸입니다. 소스가 반으로 줄어든 뒤 맛을 보고 싱거울 때만 진간장 1/2작은술씩 보충하세요.',
  짜장면: '춘장 2큰술·설탕 1작은술·진간장 1/2큰술을 기준으로 합니다. 돼지고기와 양파에서 수분이 나오므로 소스가 걸쭉해진 뒤 맛을 보고, 싱거울 때만 춘장 1/2작은술씩 추가하세요.',
  짬뽕: '물 500ml 기준 진간장 1큰술·소금 1/3작은술로 시작합니다. 채소와 고춧가루의 염도 차이가 있으니 5분 끓인 뒤 맛을 보고, 싱거울 때만 소금 1꼬집씩 추가하세요.',
  탕수육: '소스는 물 150ml·식초 3큰술·설탕 3큰술·진간장 1큰술 비율로 끓입니다. 끓인 뒤 싱거우면 간장 1/2작은술, 시면 설탕 1/2작은술을 추가하고 전분물은 1큰술씩 넣어 농도를 맞추세요.',
  카레라이스: '물 400ml와 카레가루 3큰술을 5분 끓인 뒤 맛을 봅니다. 싱거우면 소금 1/4작은술, 단맛이 부족하면 설탕 1/2작은술을 넣고 1분 더 끓이세요.',
  비빔면: '1인분 양념은 고추장 2큰술·식초 1/2큰술·설탕 1/2큰술·간장 1/2큰술·참기름 1작은술입니다. 면을 비빈 뒤 싱거울 때 고추장 1/2큰술보다 간장 1/2작은술씩 추가하세요.',
  '알리오 올리오': '면수는 물 1L에 소금 1큰술을 넣어 준비하고, 면과 면수 3큰술을 섞습니다. 완성 후 싱거우면 소금 1꼬집씩, 느끼하면 레몬즙 1작은술을 넣어 조절하세요.',
  토마토파스타: '토마토소스 200g을 5분 졸인 뒤 소금 1/3작은술을 넣습니다. 면수 2큰술을 섞고 맛을 본 뒤 싱거우면 소금 1꼬집씩, 시면 설탕 1/4작은술을 추가하세요.',
  볶음우동: '우동면 1인분에는 굴소스 1큰술·진간장 1/2큰술·설탕 1/3작은술을 사용합니다. 짜면 물 1큰술을 넣어 30초 볶고, 싱거우면 진간장 1/2작은술만 추가하세요.',
  우동: '물 500ml 기준 진간장 1큰술·소금 1/4작은술로 시작합니다. 국물을 2분 끓인 뒤 싱거우면 소금 1꼬집씩, 짜면 물 50ml씩 넣어 맞추세요.',
  잔치국수: '육수 600ml에 진간장 1큰술·소금 1/4작은술을 넣고 끓입니다. 김치나 양념장을 곁들이면 소금은 생략하고, 싱거울 때만 국간장 1/2작은술씩 추가하세요.',
  비빔국수: '고추장 2큰술·식초 1큰술·설탕 1큰술·진간장 1/2큰술·참기름 1작은술을 기준으로 합니다. 비빈 뒤 매운맛이 강하면 설탕 1/2작은술, 싱거우면 간장 1/2작은술을 추가하세요.',
  김치찌개: '물 400ml와 김치 1컵 기준 국간장 1/2큰술부터 넣습니다. 15분 끓인 뒤 싱거우면 국간장 1/2작은술씩, 짜면 물 50ml씩 넣고 2분 더 끓이세요.',
  된장찌개: '물 400ml에 된장 1큰술을 풀고 먼저 끓입니다. 채소가 익은 뒤 맛을 보고 싱거울 때만 된장 1/2작은술씩 넣으며, 소금은 된장 추가 후에도 부족할 때만 1꼬집 사용하세요.',
  순두부찌개: '물 300ml와 순두부 1봉 기준 진간장 1/2큰술·소금 1/4작은술로 맞춥니다. 계란을 넣은 뒤 싱거우면 소금 1꼬집, 매운맛이 부족하면 고춧가루 1/2작은술을 추가하세요.',
  부대찌개: '스팸·소시지·김치가 들어가므로 처음에는 진간장 1큰술만 넣습니다. 15분 끓인 뒤 싱거울 때만 소금 1꼬집 또는 진간장 1/2작은술을 추가하고, 물은 50ml씩 보충하세요.',
  미역국: '물 600ml에 국간장 1큰술을 넣고 20분 끓입니다. 마지막에 맛을 보고 싱거우면 국간장 1/2작은술씩, 짠맛이 강하면 물 50ml와 소금 대신 다진 마늘 1/2작은술을 넣으세요.',
  계란국: '물 500ml에 진간장 1큰술을 먼저 넣고, 계란을 넣은 뒤 소금 1꼬집으로 마무리합니다. 싱거울 때는 소금 1꼬집씩만 추가하고 간장을 더 넣어 국물 색이 진해지지 않게 하세요.',
  햄야채볶음: '스팸 100g 기준 굴소스 1큰술·케첩 1큰술·설탕 1/3작은술을 사용합니다. 스팸의 짠맛이 강하면 굴소스를 1/2큰술로 줄이고, 완성 후 싱거울 때만 굴소스 1/2작은술을 추가하세요.',
  계란말이: '계란 3개에는 소금 1/3작은술 또는 참치액 1작은술 중 하나만 사용합니다. 햄·치즈를 넣으면 소금은 1/4작은술로 줄이고, 계란물은 굽기 전에 맛을 보아 1꼬집씩 조절하세요.',
  감자볶음: '감자 1개 기준 소금 1/3작은술을 감자가 거의 익은 뒤 넣습니다. 베이컨이나 햄을 넣었다면 소금은 1/4작은술로 줄이고, 마지막에 후추 2꼬집으로 맛을 정리하세요.',
  토스트: '계란 1개에는 설탕 1/2큰술·소금 1꼬집만 넣습니다. 잼을 곁들이면 소금은 생략하고, 케첩이나 햄을 넣을 때는 소금 1/2꼬집으로 줄여 단짠 균형을 맞추세요.',
  샌드위치: '삶은 계란 2개와 마요네즈 2큰술에는 소금 1꼬집·후추 2꼬집을 넣습니다. 햄이나 치즈를 추가하면 소금은 넣지 말고, 싱거울 때만 머스터드 1/2작은술을 추가하세요.'
};

const cookingMethods = {
  감자전: '감자 2개를 깨끗이 씻어 강판에 갈고, 체에 밭쳐 물기를 가볍게 짭니다. 감자에 부침가루 2큰술·계란 1개·소금 1/3작은술을 섞어 반죽합니다. 팬에 식용유 2큰술을 두르고 중불로 달군 뒤 반죽을 얇게 펴서 앞뒤로 3~4분씩 노릇하게 부칩니다.',
  볶음밥: '밥 1공기와 다진 채소를 준비하고, 팬에 식용유 1큰술을 둘러 중불로 달굽니다. 채소를 2분 볶은 뒤 계란 1개를 넣어 잘게 풀고, 밥을 넣어 덩어리를 눌러가며 볶습니다. 팬 가장자리에 진간장 1큰술을 둘러 향을 낸 뒤 섞고, 부족하면 소금 1~2꼬집으로 마무리합니다.',
  오므라이스: '양파 1/4개를 잘게 다져 식용유에 2분 볶고 밥 1공기·케첩 2큰술·소금 1/4작은술을 넣어 3분 더 볶습니다. 계란 2개에 소금 1꼬집을 풀어 약불 팬에 얇게 익힌 뒤, 가운데에 볶음밥을 올리고 양옆을 접어 감쌉니다.',
  덮밥: '돼지고기 150g과 양파 1/2개를 먹기 좋은 크기로 썹니다. 팬에 돼지고기를 중불로 4분 볶아 익힌 뒤 양파를 넣고 2분 더 볶습니다. 진간장 1큰술·굴소스 1/2큰술·설탕 1/2큰술·물 3큰술을 섞어 넣고 3분간 자작하게 졸여 밥 1공기 위에 올립니다.',
  짜장면: '돼지고기 120g과 양파 1/2개를 잘게 썰어 식용유 2큰술에 중불로 3분 볶습니다. 불을 약하게 줄여 춘장 2큰술·설탕 1작은술·진간장 1/2큰술을 넣고 2분 볶아 기름에 춘장 향을 낸 뒤 물 250ml를 부어 5분 끓입니다. 전분가루 1큰술과 물 2큰술을 섞어 넣어 30초 걸쭉하게 만든 뒤 삶은 면 1인분 위에 소스를 올립니다.',
  짬뽕: '돼지고기 100g과 대파 1/2대를 식용유 1큰술에 중불로 2분 볶아 향을 냅니다. 양파 1/2개·양배추 1컵을 센 불에서 2분 볶고 고춧가루 1큰술·진간장 1큰술을 넣어 30초 더 볶은 뒤 물 500ml를 붓습니다. 소금 1/3작은술로 간하고 5분 끓인 국물에 삶은 면 1인분을 넣어 1분 데웁니다.',
  탕수육: '돼지고기 200g을 길쭉하게 썰어 소금 1/4작은술·후추 2꼬집으로 밑간하고, 전분가루 1컵과 물 3/4컵을 섞어 20분 두었다가 윗물을 따라냅니다. 고기에 전분 반죽을 묻혀 170℃ 기름에서 3분 튀긴 뒤 건져 1분 식히고, 180℃에서 1분 더 튀겨 바삭하게 만듭니다. 물 150ml·식초 3큰술·설탕 3큰술·진간장 1큰술을 끓인 뒤 전분물 1큰술을 넣어 농도를 맞추고 튀긴 고기에 곁들입니다.',
  카레라이스: '감자 1개·당근 1/3개·양파 1/2개를 한입 크기로 썰어 식용유 1큰술에 양파부터 2분 볶습니다. 감자와 당근을 넣고 3분 더 볶은 뒤 물 400ml를 부어 10분 끓입니다. 불을 약하게 줄여 카레가루 3큰술을 풀고 5분 더 저어 끓인 뒤 밥에 붓습니다.',
  비빔면: '고추장 2큰술·식초 1/2큰술·설탕 1/2큰술·간장 1/2큰술·참기름 1작은술을 그릇에 넣고 설탕이 녹을 때까지 섞습니다. 국수 1인분을 삶아 찬물에 2~3번 헹군 뒤 물기를 충분히 뺍니다. 양념장 2/3를 먼저 넣어 버무리고 맛을 보며 나머지를 추가합니다.',
  '알리오 올리오': '스파게티면 100g을 소금 1큰술을 넣은 끓는 물에 포장 시간보다 1분 짧게 삶고 면수 3큰술을 남깁니다. 팬에 올리브유 3큰술과 편 썬 마늘 4쪽을 넣어 약불에서 3분 볶습니다. 면과 면수를 넣어 1분간 섞어 소스를 입힌 뒤 소금 1꼬집과 후추로 맞춥니다.',
  토마토파스타: '면 100g을 소금물에 삶고 면수 2큰술을 남겨 둡니다. 팬에 올리브유 1큰술을 두르고 마늘 2쪽·양파 1/4개를 중불에서 3분 볶습니다. 토마토소스 200g을 넣어 5분 졸인 뒤 면과 면수를 넣고 1분 더 섞어 소금 1/3작은술로 마무리합니다.',
  볶음우동: '우동면 1인분을 끓는 물에 1분 데친 뒤 물기를 뺍니다. 팬에 식용유 1큰술을 두르고 양배추와 당근을 중불에서 3분 볶은 뒤 면을 넣습니다. 굴소스 1큰술·진간장 1/2큰술·설탕 1/3작은술·물 2큰술을 넣고 센 불에서 2분 빠르게 볶습니다.',
  우동: '냄비에 물 500ml와 다시다 1/2작은술을 넣어 끓입니다. 진간장 1큰술·소금 1/4작은술을 넣어 국물 간을 맞춘 뒤 우동면 1인분을 넣고 2분 데웁니다. 불을 끄기 직전에 대파 1/3대를 올려 뜨거운 국물에 살짝 익힙니다.',
  잔치국수: '냄비에 물 600ml와 다시다 1작은술을 넣고 끓인 뒤 진간장 1큰술·소금 1/4작은술로 육수를 맞춥니다. 국수 1인분은 별도 냄비에서 삶아 찬물에 헹구고 물기를 뺍니다. 그릇에 국수를 담고 뜨거운 육수를 부은 뒤 계란지단과 대파를 올립니다.',
  비빔국수: '고추장 2큰술·식초 1큰술·설탕 1큰술·진간장 1/2큰술·참기름 1작은술을 먼저 섞어 양념장을 만듭니다. 국수 1인분을 삶아 찬물에 헹군 뒤 물기를 빼고 양념 2/3만 넣어 버무립니다. 맛을 본 뒤 남은 양념을 조금씩 추가해 새콤함과 단맛을 조절합니다.',
  김치찌개: '냄비에 돼지고기 150g과 잘 익은 김치 1컵을 넣고 참기름 1작은술로 중불에서 3분 볶습니다. 물 400ml와 고춧가루 1/2큰술을 넣고 끓으면 중약불로 줄여 15분 끓입니다. 두부와 대파를 넣고 3분 더 끓인 뒤 부족할 때만 국간장 1/2큰술을 추가합니다.',
  된장찌개: '냄비에 물 400ml와 된장 1큰술을 체에 풀어 끓입니다. 감자·양파·애호박을 넣고 중불에서 8분 끓여 채소를 익힙니다. 두부를 넣은 뒤 다진 마늘 1/2작은술과 고춧가루 1/3작은술을 넣고 3분 더 끓인 다음, 마지막에 소금으로 간을 조절합니다.',
  순두부찌개: '냄비에 식용유 1큰술을 두르고 고춧가루 1큰술·다진 마늘 1/2큰술을 약불에서 30초 볶아 향을 냅니다. 물 300ml와 순두부 1봉을 넣고 중불에서 5분 끓입니다. 진간장 1/2큰술·소금 1/4작은술로 간을 맞추고 계란 1개를 올려 1분 더 익힙니다.',
  부대찌개: '냄비에 먹기 좋게 썬 스팸 100g·소시지 100g·김치 1/2컵을 담고 물 500ml를 붓습니다. 고춧가루 1큰술·진간장 1큰술·다진 마늘 1/2큰술을 넣고 끓으면 중불로 줄여 15분 끓입니다. 재료에서 간이 우러난 뒤 맛을 보고 부족할 때만 소금 1꼬집을 추가합니다.',
  미역국: '불린 미역 1컵은 물기를 짜고 먹기 좋게 자릅니다. 냄비에 미역과 소고기 100g을 넣고 참기름 1큰술로 중불에서 3분 볶습니다. 물 600ml를 넣고 끓으면 약불로 줄여 20분 끓인 뒤 국간장 1큰술·소금 1/4작은술로 간을 맞춥니다.',
  계란국: '냄비에 물 500ml·다시다 1/2작은술·진간장 1큰술을 넣고 끓입니다. 계란 2개를 충분히 풀어 국물이 끓는 지점에 가늘게 부은 뒤 30초간 젓지 않고 익힙니다. 대파를 넣고 마지막에 소금 1~2꼬집으로만 간을 조절합니다.',
  햄야채볶음: '스팸 100g과 양파·당근·양배추를 한입 크기로 썹니다. 팬에 식용유 1큰술을 두르고 스팸을 먼저 2분 볶은 뒤 채소를 넣어 3분 더 볶습니다. 굴소스 1큰술·케첩 1큰술·설탕 1/3작은술을 넣고 센 불에서 1분간 섞어 마무리합니다.',
  계란말이: '계란 3개에 소금 1/3작은술·물 1큰술을 풀고 다진 당근과 대파를 섞습니다. 팬에 식용유를 얇게 두르고 약불로 달군 뒤 계란물을 3~4번 나누어 붓습니다. 표면이 반쯤 익었을 때마다 돌돌 말고, 완성 후 1분 식혀 단단하게 썹니다.',
  감자볶음: '감자 1개와 당근·양파를 가늘게 채 썰어 감자는 물에 2분 담갔다가 물기를 뺍니다. 팬에 식용유 1큰술을 두르고 감자를 중불에서 4분 볶은 뒤 물 2큰술을 넣고 뚜껑을 덮어 2분 익힙니다. 당근과 양파를 넣고 소금 1/3작은술·후추를 넣어 2분 더 볶습니다.',
  토스트: '계란 1개에 설탕 1/2큰술·소금 1꼬집을 풀어 식빵 2장 양면에 고르게 묻힙니다. 팬에 식용유 1큰술을 두르고 중약불에서 빵을 앞뒤로 2~3분씩 구워 속까지 익힙니다. 노릇해진 토스트에 취향에 따라 설탕이나 잼을 소량 곁들입니다.',
  샌드위치: '계란 2개를 10분 삶아 껍질을 벗긴 뒤 포크로 으깹니다. 마요네즈 2큰술·소금 1꼬집·후추 약간을 섞어 계란 샐러드를 만들고, 식빵에 물기를 닦은 양배추를 먼저 올립니다. 계란 샐러드를 얹어 간을 본 뒤 다른 식빵으로 덮어 반으로 자릅니다.'
};

const extraIngredientTips = {
  감자전: '쪽파·청양고추·새우를 추가하면 향과 감칠맛이 살아납니다. 반죽을 얇게 펴고 새우를 올려 함께 부치세요.',
  볶음밥: '대파·굴소스·참기름·김가루를 추가하면 풍미가 깊어집니다. 대파를 기름에 먼저 볶아 향을 낸 뒤 밥을 넣으세요.',
  오므라이스: '우유 1큰술과 버터 1작은술을 계란에 넣으면 더 부드럽고, 다진 햄이나 완두콩을 볶음밥에 넣으면 식감이 좋아집니다.',
  덮밥: '생강 1/2작은술·대파·계란 노른자를 추가하면 돼지고기의 잡내가 줄고 소스의 깊이가 커집니다. 마지막에 노른자를 올려 비벼 드세요.',
  카레라이스: '다진 마늘 1/2작은술과 버터 1작은술을 추가하면 향이 풍부해집니다. 불을 끈 뒤 버터를 넣어 녹이세요.',
  비빔면: '참기름 1작은술·깨 1작은술·삶은 계란을 추가하면 고소함과 식감이 좋아집니다. 양념을 비빈 뒤 마지막에 넣으세요.',
  '알리오 올리오': '페페론치노 1~2개·파슬리·새우를 추가하면 향과 감칠맛이 좋아집니다. 마늘이 노릇해지기 직전에 페페론치노를 넣으세요.',
  토마토파스타: '베이컨·바질·파마산 치즈를 추가하면 풍미가 선명해집니다. 치즈는 불을 끈 뒤 면수와 함께 섞으세요.',
  볶음우동: '가쓰오부시·대파·숙주를 추가하면 일식 볶음우동의 향과 아삭한 식감이 살아납니다. 가쓰오부시는 불을 끈 뒤 올리세요.',
  우동: '유부·가쓰오부시·표고버섯을 추가하면 국물이 더 깊어집니다. 가쓰오부시는 오래 끓이지 말고 불을 끈 뒤 우려내세요.',
  잔치국수: '애호박·김가루·깨·참기름을 추가하면 고명과 고소한 향이 풍성해집니다. 참기름은 그릇에 담은 뒤 몇 방울만 넣으세요.',
  비빔국수: '김가루·오이·삶은 계란을 추가하면 매운맛이 부드러워지고 식감이 좋아집니다. 오이는 소금에 절이지 않고 바로 올리세요.',
  김치찌개: '다진 마늘·대파·두부·돼지고기 목살을 추가하면 국물의 깊이가 커집니다. 대파는 마지막 5분에 넣어 향을 살리세요.',
  된장찌개: '멸치·다시마 육수와 표고버섯·청양고추를 추가하면 구수함과 감칠맛이 강해집니다. 다시마는 끓기 직전에 건지세요.',
  순두부찌개: '바지락·돼지고기·참기름을 추가하면 감칠맛이 좋아집니다. 참기름에 고춧가루를 볶은 뒤 바지락을 먼저 익히세요.',
  부대찌개: '라면사리·대파·치즈 1장을 추가하면 풍성하고 부드러워집니다. 치즈는 마지막 1분에 올려 국물에 살짝 녹이세요.',
  미역국: '다진 마늘·참기름·소고기 양지 또는 조개를 추가하면 국물 맛이 깊어집니다. 마늘은 고기를 볶을 때 함께 넣으세요.',
  계란국: '대파·후추·참기름 몇 방울을 추가하면 깔끔한 국물에 향이 더해집니다. 참기름은 불을 끈 뒤 넣어 향을 보존하세요.',
  햄야채볶음: '마늘·대파·후추·케첩을 추가하면 햄의 풍미가 선명해집니다. 케첩은 굴소스와 함께 마지막 1분에 넣으세요.',
  계란말이: '치즈·명란·쪽파를 추가하면 속재료가 풍성해집니다. 치즈는 계란물이 반쯤 익었을 때 중앙에 올려 말아주세요.',
  감자볶음: '베이컨·청양고추·참깨를 추가하면 감칠맛과 향이 좋아집니다. 베이컨을 먼저 볶아 나온 기름에 감자를 볶으세요.',
  토스트: '버터·치즈·햄·딸기잼을 추가하면 단짠 조합이 좋아집니다. 치즈와 햄은 빵이 따뜻할 때 넣어 녹이세요.',
  샌드위치: '후추·머스터드·치즈·토마토를 추가하면 풍미와 촉촉함이 좋아집니다. 토마토의 물기는 닦고 마지막에 넣으세요.'
};

const RECIPE_DETAIL_INFO = {
  seasoningTips,
  cookingMethods,
  extraIngredientTips
};

function getCanonicalRecipeName(recipe) {
  const recipeName = String(recipe?.name || '').trim();
  return ['덮밥', '돼지고기덮밥', '돼지고기 덮밥'].includes(recipeName) ? '덮밥' : recipeName;
}

function getExtraIngredientTip(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.extraIngredientTips[recipeName] || '대파·마늘·후추를 소량 추가하고, 향신 재료는 마지막에 넣어 재료 본연의 맛을 살려보세요.';
}

function getCookingMethod(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.cookingMethods[recipeName] || (recipe?.steps || []).join(' → ');
}

function getSeasoningTip(recipe) {
  const recipeName = getCanonicalRecipeName(recipe);
  return RECIPE_DETAIL_INFO.seasoningTips[recipeName]
    || '재료에서 나오는 염도를 먼저 확인하고, 조리가 끝나기 직전에 한 꼬집씩 보충해 가장 알맞은 간을 맞추세요.';
}

function decorateSubstituteTips(detailContainer, recipe) {
  const tips = Array.isArray(recipe?.substituteTips) ? recipe.substituteTips : [];
  const tipsList = detailContainer.querySelector('.substitute-tips .tips-list');
  if (!tipsList || !tips.length) return;

  tipsList.innerHTML = tips.map((tip) => {
    const original = String(tip?.original || '').trim();
    const alternatives = (Array.isArray(tip?.alternatives) ? tip.alternatives : [tip?.alternatives])
      .filter(Boolean)
      .map((item) => String(item).trim())
      .filter(Boolean);
    const note = String(tip?.note || '')
      .replace(/\band\b/gi, '그리고')
      .replace(/\s+/g, ' ')
      .trim();
    if (!original || !alternatives.length) return '';

    return `
      <li>
        <strong>${escapeHtml(original)}</strong> 재료가 없을 때는 ${escapeHtml(alternatives.join(' 또는 '))}를 사용해 보세요.
        ${note ? `<span>${escapeHtml(note)}</span>` : ''}
      </li>
    `;
  }).join('');
}

function getRecipeName(recipe) {
  return getCanonicalRecipeName(recipe) === '덮밥' ? '돼지고기 덮밥' : recipe?.name;
}

function classifyCuisine(recipe) {
  const recipeName = String(recipe?.name || '').trim();
  if (cuisineOverrides[recipeName]) return cuisineOverrides[recipeName];
  if (String(recipe?.id || '').startsWith('alt')) return '편의점';
  const text = [recipe.name, recipe.category, ...(recipe.ingredients || [])].join(' ');
  const matched = Object.entries(cuisineKeywords)
    .map(([cuisine, keywords]) => ({
      cuisine,
      score: keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  // 데이터에 명확한 외국 음식 단서가 없으면 기본 한식으로 분류합니다.
  return matched[0]?.score > 0 ? matched[0].cuisine : '한식';
}

const preferenceRules = [
  { keywords: ['매운'], test: (recipe) => contains(recipe, ['매운', '고추', '김치', '찌개', '볶음']) },
  { keywords: ['다이어트'], test: (recipe) => contains(recipe, ['샐러드', '채소', '두부', '닭', '계란']) },
  { keywords: ['고단백'], test: (recipe) => contains(recipe, ['고기', '닭', '계란', '두부', '참치', '새우']) },
  { keywords: ['국물'], test: (recipe) => contains(recipe, ['국', '탕', '찌개', '라면', '우동']) },
  { keywords: ['밥요리'], test: (recipe) => contains(recipe, ['밥', '볶음밥', '덮밥', '김밥']) },
  { keywords: ['면요리'], test: (recipe) => contains(recipe, ['면', '라면', '우동', '파스타', '국수']) },
  { keywords: ['간식'], test: (recipe) => contains(recipe, ['토스트', '샌드위치', '팬케이크', '과자', '간식']) },
  { keywords: ['간단한 요리'], test: (recipe) => recipe.difficulty === '쉬움' || getMinutes(recipe) <= 15 },
  { keywords: ['10분'], test: (recipe) => getMinutes(recipe) <= 10 },
  { keywords: ['쉬움'], test: (recipe) => recipe.difficulty === '쉬움' },
  { keywords: ['보통'], test: (recipe) => recipe.difficulty === '보통' },
  { keywords: ['어려움'], test: (recipe) => recipe.difficulty === '어려움' },
  { keywords: ['아침'], test: (recipe) => getMinutes(recipe) <= 20 || contains(recipe, ['토스트', '밥', '계란']) },
  { keywords: ['야식'], test: (recipe) => contains(recipe, ['라면', '면', '볶음', '치즈', '밥']) },
  { keywords: ['냉장고 털이'], test: (recipe) => recipe.missing.length <= 1 },
  { keywords: ['저녁'], test: (recipe) => getMinutes(recipe) >= 15 || recipe.difficulty !== '쉬움' },
  { keywords: ['혼밥'], test: (recipe) => getMinutes(recipe) <= 25 && !contains(recipe, ['찌개', '국']) },
  { keywords: ['술안주'], test: (recipe) => contains(recipe, ['볶음', '전', '튀김', '치즈', '햄', '감자']) },
  { keywords: ['손님용'], test: (recipe) => contains(recipe, ['볶음', '파스타', '전', '오므라이스', '샌드위치']) },
  { keywords: ['도시락'], test: (recipe) => !contains(recipe, ['국', '찌개', '탕']) && getMinutes(recipe) <= 30 }
];

function getMinutes(recipe) {
  const value = String(recipe?.time || '').match(/\d+/);
  return value ? Number(value[0]) : Number.MAX_SAFE_INTEGER;
}

function contains(recipe, words) {
  const text = [recipe.name, recipe.category, ...(recipe.ingredients || [])].join(' ').toLowerCase();
  return words.some((word) => text.includes(word.toLowerCase()));
}

function getPreferenceRule(label) {
  return preferenceRules.find((rule) => rule.keywords.some((keyword) => label.includes(keyword)));
}

function isFilterPreference(label) {
  return Boolean(getPreferenceRule(label));
}

export function applyRecipeFilters() {
  const sourceRecipes = Array.isArray(state.recipePool) && state.recipePool.length > 0
    ? state.recipePool
    : state.carouselRecipes;
  if (!Array.isArray(sourceRecipes)) return;

  const recipes = sourceRecipes.map((recipe) => {
    const preferenceScore = [...selectedPreferences].reduce((score, label) => {
      const rule = getPreferenceRule(label);
      return score + (rule && rule.test(recipe) ? 1 : 0);
    }, 0);

    return {
      ...recipe,
      name: getRecipeName(recipe),
      cuisine: classifyCuisine(recipe),
      preferenceScore
    };
  });

  // 편의점 꿀조합은 취향·상황·요리 종류·난이도·검색 조건과 관계없이 전체 목록을 보여줍니다.
  if (state.showingAlternatives) {
    const allAlternativeRecipes = recipes.sort((a, b) =>
      b.rate - a.rate || getMinutes(a) - getMinutes(b)
    );
    recipeSearchQuery = '';
    activeDifficultyFilter = 'all';
    state.carouselRecipes = allAlternativeRecipes;
    state.currentCarouselIndex = 0;
    return;
  }

  const availableRecipes = recipes.filter((recipe) =>
    activeDifficultyFilter === 'all' || recipe.difficulty === activeDifficultyFilter
  );
  const filterPreferences = [...selectedPreferences].filter(isFilterPreference);
  const cuisineFilteredRecipes = selectedCuisines.size
    ? availableRecipes.filter((recipe) => selectedCuisines.has(recipe.cuisine))
    : availableRecipes;
  const filteredRecipes = filterPreferences.length
    ? cuisineFilteredRecipes.filter((recipe) => filterPreferences.some((label) => {
      const rule = getPreferenceRule(label);
      return rule && rule.test(recipe);
    }))
    : cuisineFilteredRecipes;

  const query = normalizeSearchText(recipeSearchQuery);
  const searchedRecipes = query
    ? filteredRecipes.filter((recipe) =>
      normalizeSearchText([recipe.name, recipe.cuisine, recipe.category].join(' ')).includes(query)
    )
    : filteredRecipes;

  searchedRecipes.sort((a, b) =>
    b.rate - a.rate ||
    b.preferenceScore - a.preferenceScore ||
    (a.missing?.length || 0) - (b.missing?.length || 0) ||
    getMinutes(a) - getMinutes(b)
  );

  // 메뉴는 전체 필터 결과를 사용하고, 캐러셀만 매칭율 상위 10개로 제한합니다.
  state.carouselRecipes = state.recipeViewMode === 'menu'
    ? searchedRecipes
    : searchedRecipes.slice(0, 10);
  const visibleRecipes = state.carouselRecipes;
  if (state.currentCarouselIndex >= visibleRecipes.length) state.currentCarouselIndex = 0;
}

function addCuisineChoices() {
  const modalContent = document.querySelector('#taste-modal .taste-modal-content');
  if (!modalContent || modalContent.querySelector('[data-cuisine-filter]')) return;

  const section = document.createElement('div');
  section.dataset.cuisineFilter = 'true';
  section.className = 'taste-section';
  section.style.marginTop = '20px';
  section.innerHTML = `
    <h4 class="taste-section-title">요리 종류</h4>
    <div class="chip-container">
      ${Object.keys(cuisineKeywords).map((cuisine) => `
        <button type="button" class="chip-btn" data-cuisine="${cuisine}">${cuisine}</button>
      `).join('')}
    </div>
  `;
  modalContent.insertBefore(section, modalContent.querySelector('.modal-actions'));
}

function rememberTasteChoices() {
  selectedPreferences.clear();
  selectedCuisines.clear();
  document.querySelectorAll('#taste-modal .chip-btn.active').forEach((chip) => {
    const label = chip.textContent.trim();
    selectedPreferences.add(label);
    const cuisine = ['한식', '양식', '일식', '중식'].find((name) => label.includes(name));
    if (cuisine) selectedCuisines.add(cuisine);
  });
}

export function decorateRecipeCard() {
  if (state.route !== 'recipes' || state.recipeViewMode !== 'menu') return;
  const recipesContainer = document.querySelector('.recipes-container');
  if (recipesContainer && !recipesContainer.querySelector('[data-recipe-toolbar]')) {
    const toolbar = document.createElement('div');
    toolbar.dataset.recipeToolbar = 'true';
    toolbar.style.cssText = 'margin:0 auto 18px; max-width:760px; padding:14px; border:2px solid var(--color-charcoal); border-radius:var(--br-lg); background:var(--color-cream); box-shadow:0 4px 0 var(--color-charcoal);';
    toolbar.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px;">
        ${['all', '한식', '중식', '일식', '양식', '편의점'].map((cuisine) => `
          <button type="button" class="chip-btn ${cuisine === 'all' && selectedCuisines.size === 0 ? 'active' : ''}" data-cuisine-filter="${cuisine}">
            ${cuisine === 'all' ? '전체' : cuisine}
          </button>
        `).join('')}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px;">
        ${['all', '쉬움', '보통', '어려움'].map((difficulty) => `
          <button type="button" class="chip-btn ${difficulty === activeDifficultyFilter ? 'active' : ''}" data-difficulty-filter="${difficulty}">
            ${difficulty === 'all' ? '난이도 전체' : difficulty}
          </button>
        `).join('')}
      </div>
      <label style="display:block;">
        <span style="display:block; margin-bottom:5px; font-size:13px; font-weight:800;">레시피 검색</span>
        <input type="search" value="${escapeHtml(recipeSearchQuery)}" data-recipe-search placeholder="레시피 이름을 검색하세요!" style="box-sizing:border-box; width:100%; padding:10px 12px; border:2px solid var(--color-charcoal); border-radius:var(--br-md); background:#fff; font:inherit;">
      </label>
    `;
    const carousel = recipesContainer.querySelector('.carousel-wrapper');
    if (carousel) recipesContainer.insertBefore(toolbar, carousel);
    else recipesContainer.prepend(toolbar);
  }

  // 필터 변경 후에도 버튼이 현재 선택 상태를 반영하도록 동기화합니다.
  recipesContainer?.querySelectorAll('[data-cuisine-filter]').forEach((button) => {
    const cuisine = button.dataset.cuisineFilter;
    const isActive = cuisine === 'all'
      ? selectedCuisines.size === 0
      : selectedCuisines.has(cuisine);
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  recipesContainer?.querySelectorAll('[data-difficulty-filter]').forEach((button) => {
    const isActive = button.dataset.difficultyFilter === activeDifficultyFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (!state.carouselRecipes.length) return;

  if (recipesContainer) {
    const carousel = recipesContainer.querySelector('.carousel-wrapper');
    const dots = recipesContainer.querySelector('.carousel-dots');
    const carouselCount = [...recipesContainer.children].find((child) => child.tagName === 'P');
    if (carousel) carousel.style.display = 'none';
    if (dots) dots.style.display = 'none';
    if (carouselCount) carouselCount.style.display = 'none';

    let overview = recipesContainer.querySelector('[data-recipe-overview]');
    if (!overview) {
      overview = document.createElement('div');
      overview.dataset.recipeOverview = 'true';
      if (carousel) recipesContainer.insertBefore(overview, carousel);
      else recipesContainer.appendChild(overview);
    }

    if (state.carouselRecipes.length === 0) {
      // app.js가 빈 결과 화면을 렌더한 직후에도 이전 카드와 페이지네이션이 남지 않도록 정리합니다.
      carousel?.querySelector('.carousel-track')?.replaceChildren();
      dots?.replaceChildren();
      overview.replaceChildren();
      overview.style.cssText = 'width:100%; max-width:1400px; margin:0 auto 18px;';
      overview.innerHTML = `
        <div style="width:100%; padding:30px; box-sizing:border-box; text-align:center;">
          검색 조건에 맞는 레시피가 없어요.
        </div>
      `;
      return;
    }

    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(state.carouselRecipes.length / pageSize));
    recipePage = Math.min(recipePage, pageCount);
    const pageRecipes = state.carouselRecipes.slice((recipePage - 1) * pageSize, recipePage * pageSize);
    overview.style.cssText = 'width:100%; max-width:1400px; margin:0 auto 18px;';
    overview.innerHTML = `
      <div style="display:grid; width:100%; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:16px; align-items:stretch;">
        ${pageRecipes.length ? pageRecipes.map((recipe) => `
          <article class="recipe-card-box" style="width:100%; min-width:0; box-sizing:border-box; display:flex; flex-direction:column;">
            <div class="recipe-card-header" style="min-height:48px;">${recipe.emoji || '🍽️'}</div>
            <div class="recipe-card-body" style="padding:12px; flex:1; display:flex; flex-direction:column;">
              <h3 class="recipe-card-title" style="font-size:16px; word-break:keep-all;">${escapeHtml(getRecipeName(recipe))}</h3>
              <div class="recipe-meta-tags" style="margin:8px 0;">
                <span class="recipe-meta-tag">${recipe.difficulty || ''}</span>
                <span class="recipe-meta-tag">⏱️ ${recipe.time || ''}</span>
              </div>
              <div style="font-size:12px; line-height:1.5; margin-bottom:10px;">
                매치율 ${recipe.rate || 0}%<br>
                부족한 재료 ${recipe.missing?.length || 0}개<br>
                ${recipe.missing?.length ? escapeHtml(recipe.missing.join(', ')) : '부족한 재료 없음'}
              </div>
              <button type="button" class="btn btn-primary" data-overview-recipe="${recipe.id}" style="width:100%; margin-top:auto; padding:7px 4px; font-size:12px;">자세히 보기</button>
            </div>
          </article>
        `).join('') : '<p style="grid-column:1/-1; padding:30px; text-align:center;">검색 조건에 맞는 레시피가 없어요.</p>'}
      </div>
      ${pageCount > 1 ? `
        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
          <button type="button" class="btn btn-outline" data-recipe-page="prev" ${recipePage === 1 ? 'disabled' : ''}>이전</button>
          <strong>${recipePage} / ${pageCount}</strong>
          <button type="button" class="btn btn-outline" data-recipe-page="next" ${recipePage === pageCount ? 'disabled' : ''}>다음</button>
        </div>
      ` : ''}
    `;
  }

}

function renderCarouselMissingIngredients(recipe) {
  const missing = Array.isArray(recipe?.missing) ? recipe.missing : [];
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const tips = Array.isArray(recipe?.substituteTips) ? recipe.substituteTips : [];
  const applicableTips = tips
    .filter((tip) => tip && tip.original && Array.isArray(tip.alternatives) && tip.alternatives.length)
    .filter((tip) => missing.some((ingredient) => normalize(ingredient) === normalize(tip.original)));
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
      `${escapeHtml(tip.original)} 대신 ${tip.alternatives.map(escapeHtml).join(', ')}를 사용해보세요.`
    );
    if (unresolved.length > 0) {
      substitutions.push(`여전히 필요한 재료: ${unresolved.map(escapeHtml).join(', ')}`);
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
      <div class="recipe-missing-items">${missing.map(escapeHtml).join(', ')}</div>
    </div>
  `;
}

function renderCarouselRecipeCard(recipe) {
  const missing = renderCarouselMissingIngredients(recipe);
  const isFav = state.favorites.has(recipe.id);
  return `
    <div class="recipe-card-box" style="height:100%;">
      <div class="recipe-card-header">
        ${recipe.emoji || '🍽️'}
        <button class="recipe-fav-toggle ${isFav ? 'active' : ''}" data-recipe-id="${recipe.id}" aria-label="즐겨찾기">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="recipe-card-body" style="display:flex; flex-direction:column; height:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <h3 class="recipe-card-title">${escapeHtml(getRecipeName(recipe))}</h3>
          <span class="recipe-meta-tag match-tag">매치율 ${recipe.rate || 0}%</span>
        </div>
        <div class="recipe-meta-tags">
          <span class="recipe-meta-tag">⭐ ${escapeHtml(recipe.difficulty || '')}</span>
          <span class="recipe-meta-tag">⏱️ ${escapeHtml(recipe.time || '')}</span>
        </div>
        ${missing}
        <div class="recipe-action" style="margin-top:auto; width:100%;">
          <button class="btn btn-primary recipe-detail-btn" id="btn-view-steps-${recipe.id}" data-rid="${recipe.id}">
            ${String(recipe.id).startsWith('alt') ? '영수증 보기' : '레시피 보기'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function decorateCarouselView() {
  if (state.route !== 'recipes' || state.recipeViewMode === 'menu') return;
  const recipesContainer = document.querySelector('.recipes-container');
  const carousel = recipesContainer?.querySelector('.carousel-wrapper');
  if (!recipesContainer || !carousel) return;

  let toolbar = recipesContainer.querySelector('[data-recipe-display-toolbar]');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.dataset.recipeDisplayToolbar = 'true';
    toolbar.style.cssText = 'display:flex; justify-content:flex-end; align-items:center; gap:8px; margin:0 0 10px;';
    toolbar.innerHTML = `
      <span style="font-size:13px; font-weight:800; color:var(--color-gray);">보기</span>
      <button type="button" class="btn btn-outline" data-recipe-display="one" style="padding:6px 10px; font-size:12px;">1개 보기</button>
      <button type="button" class="btn btn-outline" data-recipe-display="three" style="padding:6px 10px; font-size:12px;">3개 보기</button>
    `;
    recipesContainer.insertBefore(toolbar, carousel);
  }

  const displayMode = state.recipeCardDisplayMode || 'one';
  toolbar.querySelectorAll('[data-recipe-display]').forEach((button) => {
    const active = button.dataset.recipeDisplay === displayMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const track = carousel.querySelector('.carousel-track');
  if (!track) return;
  carousel.querySelectorAll('#btn-carousel-prev, #btn-carousel-next').forEach((button) => {
    button.style.zIndex = '20';
    button.style.pointerEvents = 'auto';
  });
  if (displayMode === 'three' && state.carouselRecipes.length > 1) {
    const recipes = state.carouselRecipes;
    const pageSize = 3;
    const pageCount = Math.ceil(recipes.length / pageSize);
    const currentPage = Math.min(
      Math.floor(state.currentCarouselIndex / pageSize),
      pageCount - 1
    );
    state.currentCarouselIndex = currentPage * pageSize;
    const visibleRecipes = recipes.slice(
      state.currentCarouselIndex,
      state.currentCarouselIndex + pageSize
    );
    track.innerHTML = visibleRecipes.map(renderCarouselRecipeCard).join('');
    // 1개 보기의 카드 폭은 유지하고, 3개 보기에서만 카드 3개가 들어갈 만큼 프레임을 확장합니다.
    carousel.style.maxWidth = '1120px';
    track.style.cssText = 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:16px; align-items:stretch; width:100%;';
    const dislikeButton = carousel.querySelector('#btn-dislike-recipe');
    if (dislikeButton) {
      dislikeButton.style.right = visibleRecipes.length === 1 ? 'calc(66.666% + 6px)' : '6px';
    }

    const dots = recipesContainer.querySelector('.carousel-dots');
    if (dots) {
      dots.innerHTML = Array.from({ length: pageCount }, (_, page) => `
        <span class="carousel-dot ${page === currentPage ? 'active' : ''}" data-index="${page * pageSize}"></span>
      `).join('');
    }
    const counter = dots?.nextElementSibling;
    if (counter?.tagName === 'P') counter.textContent = `${currentPage + 1} / ${pageCount}`;
  } else {
    carousel.style.maxWidth = '';
    track.style.cssText = '';
    const dislikeButton = carousel.querySelector('#btn-dislike-recipe');
    if (dislikeButton) dislikeButton.style.right = '';
  }

  bindCarouselNavigation(carousel);
}

function moveCarousel(offset) {
  const recipes = state.carouselRecipes;
  if (!recipes.length) return;

  const pageSize = state.recipeCardDisplayMode === 'three' ? 3 : 1;
  if (pageSize === 1) {
    state.currentCarouselIndex = (state.currentCarouselIndex + offset + recipes.length) % recipes.length;
  } else {
    const pageCount = Math.ceil(recipes.length / pageSize);
    const currentPage = Math.floor(state.currentCarouselIndex / pageSize);
    state.currentCarouselIndex = ((currentPage + offset + pageCount) % pageCount) * pageSize;
  }
  state.carouselDirection = offset > 0 ? 'right' : 'left';
  // 편의점 레시피는 applyRecipeFilters()가 실행될 때마다 인덱스를 0으로
  // 초기화하므로, 카드 이동 중에는 현재 결과 목록을 그대로 유지합니다.
  state.preserveRecipeResults = true;
  render();
  decorateCarouselView();
}

function bindCarouselNavigation(carousel) {
  const previous = carousel.querySelector('#btn-carousel-prev');
  const next = carousel.querySelector('#btn-carousel-next');
  if (previous) {
    previous.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCarousel(-1);
    };
  }
  if (next) {
    next.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCarousel(1);
    };
  }

  carousel.querySelectorAll('.carousel-dot').forEach((dot) => {
    dot.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.currentCarouselIndex = Number(dot.dataset.index) || 0;
      state.preserveRecipeResults = true;
      render();
      decorateCarouselView();
    };
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function refreshRecipeResults() {
  updateCarouselRecipes();
  applyRecipeFilters();
  state.currentCarouselIndex = 0;
  recipePage = 1;
  render();
  decorateRecipeCard();
  const searchInput = document.querySelector('[data-recipe-search]');
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFC').toLowerCase().trim();
}

function scheduleRecipeSearch(searchInput) {
  clearTimeout(searchRefreshTimer);
  searchRefreshTimer = setTimeout(() => {
    if (isSearchComposing || !document.body.contains(searchInput)) return;
    recipeSearchQuery = searchInput.value;
    refreshRecipeResults();
  }, 180);
}

function getRecipeInsight(recipe) {
  return recipeInsightPresets[getCanonicalRecipeName(recipe)] || null;
}

function renderRecipeInsightPanel(leftPage, recipe) {
  if (!leftPage) return;
  const insight = getRecipeInsight(recipe);
  const existing = leftPage.querySelector('[data-recipe-insight]');
  if (!insight) {
    existing?.remove();
    return;
  }

  const isCurrentRecipe = recipeInsightState.recipeId === recipe.id;
  const status = isCurrentRecipe ? recipeInsightState.status : 'idle';
  const panel = existing || document.createElement('section');
  panel.dataset.recipeInsight = 'true';
  panel.style.cssText = 'margin-top:14px; padding:12px; border:2px solid var(--color-orange-deep); border-radius:var(--br-md); background:linear-gradient(135deg, #fff8ed, #fffdf8); color:var(--color-charcoal); font-size:12px; line-height:1.55; text-align:left;';

  if (status === 'loading') {
    panel.innerHTML = `
      <strong style="display:block; color:var(--color-orange-deep);">🤖 AI가 정보를 정리하고 있어요</strong>
      <span style="display:block; margin-top:4px;">보관 권장기간과 1인분 예상비용을 계산하는 중...</span>
      <span aria-hidden="true" style="display:block; margin-top:7px; width:100%; height:5px; border-radius:99px; background:var(--color-cream-dark); overflow:hidden;"><i style="display:block; width:45%; height:100%; background:var(--color-orange); animation:progress-loading 1s ease-in-out infinite alternate;"></i></span>
    `;
  } else if (status === 'ready') {
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;"><strong style="color:var(--color-orange-deep);">🤖 AI 판단 요약</strong><span style="font-size:10px; color:var(--color-gray);">순두부찌개</span></div>
      <div style="margin-top:8px; padding:8px; border-radius:10px; background:#fff;"><strong>💰 1인분 예상비용 ${escapeHtml(insight.cost)}</strong><div style="margin-top:2px; color:var(--color-gray);">${escapeHtml(insight.costBasis)}</div></div>
      <div style="margin-top:8px;"><strong>🧊 권장 보관기간</strong><ul style="margin:4px 0 0; padding-left:18px;">${insight.storage.map(([name, period]) => `<li><b>${escapeHtml(name)}</b>: ${escapeHtml(period)}</li>`).join('')}</ul></div>
      <p style="margin:8px 0 0; font-size:10px; color:var(--color-gray);">${escapeHtml(insight.note)}</p>
    `;
  } else {
    panel.innerHTML = `
      <strong style="display:block; color:var(--color-orange-deep);">🤖 AI 판단 정보</strong>
      <p style="margin:4px 0 8px;">공개 보관 가이드와 재료 구성을 참고해 보관기간과 조리 비용을 정리해 드려요.</p>
      <button type="button" class="btn btn-secondary btn-sm" data-recipe-insight-start style="width:100%;">보관·비용 분석하기</button>
    `;
  }

  if (!existing) leftPage.appendChild(panel);
}

function startRecipeInsight(recipe, detailContainer) {
  const insight = getRecipeInsight(recipe);
  if (!insight || (recipeInsightState.recipeId === recipe.id && recipeInsightState.status === 'loading')) return;

  recipeInsightState.recipeId = recipe.id;
  recipeInsightState.status = 'loading';
  renderRecipeInsightPanel(detailContainer.querySelector('.notebook-left-page'), recipe);

  window.setTimeout(() => {
    if (state.route !== 'detail' || state.currentDetail !== recipe.id) return;
    recipeInsightState.status = 'ready';
    renderRecipeInsightPanel(detailContainer.querySelector('.notebook-left-page'), recipe);
  }, 1100);
}

export function decorateDetailPage() {
  if (state.route !== 'detail') return;
  const aiReason = document.querySelector('.notebook-ai-reason');
  const detailContainer = document.querySelector('.detail-container');
  if (!detailContainer) return;

  const detailTitle = detailContainer.querySelector('.notebook-recipe-title');
  if (detailTitle) {
    const displayedName = detailTitle.textContent.trim();
    if (displayedName === '덮밥' || displayedName === '돼지고기덮밥' || displayedName === '돼지고기 덮밥') {
      detailTitle.textContent = '돼지고기 덮밥';
    }
  }

  const recipe = state.carouselRecipes?.find((item) => item.id === state.currentDetail)
    || [...RECIPES, ...ALTERNATIVE_RECIPES].find((item) => item.id === state.currentDetail);
  if (!recipe) return;

  if (detailTitle) detailTitle.textContent = getRecipeName(recipe);

  document.querySelectorAll('.notebook-notepad .notepad-title').forEach((title) => {
    if (title.textContent.includes('요리 순서') || title.textContent.includes('주방 순서')) title.textContent = '🍳 조리방법';
  });
  document.querySelectorAll('.tips-title').forEach((title) => {
    if (title.textContent.includes('대체 재료 팁')) title.textContent = '💡 대체 재료 팁';
  });
  decorateSubstituteTips(detailContainer, recipe);

  const leftPage = detailContainer.querySelector('.notebook-left-page');
  if (leftPage && !leftPage.querySelector('[data-extra-ingredients]')) {
    const extraIngredients = document.createElement('section');
    extraIngredients.dataset.extraIngredients = 'true';
    extraIngredients.style.cssText = 'margin-top:14px; padding:12px; border:2px dashed var(--color-mint-deep); border-radius:var(--br-md); background:var(--color-mint-light); color:var(--color-charcoal); font-size:13px; line-height:1.6; text-align:left;';
    extraIngredients.innerHTML = `
      <strong>✨ 더 맛있게 추가해보세요</strong>
      <p style="margin:7px 0 0;">${escapeHtml(getExtraIngredientTip(recipe))}</p>
    `;
    const meta = leftPage.querySelector('.notebook-detail-meta');
    if (meta) meta.insertAdjacentElement('afterend', extraIngredients);
    else leftPage.appendChild(extraIngredients);
  }

  renderRecipeInsightPanel(leftPage, recipe);

  // 좌측의 감성적인 AI 설명은 제거하고, 구체적인 조리방법은 우측 순서 영역에 넣습니다.
  if (aiReason) aiReason.remove();
  const stepsList = detailContainer.querySelector('.notepad-steps');
  if (stepsList && !stepsList.dataset.detailedCookingMethod) {
    stepsList.dataset.detailedCookingMethod = 'true';
    const rawMethodSteps = getCookingMethod(recipe)
      .split(/(?<=\.)\s+/)
      .filter(Boolean);
    const methodSteps = rawMethodSteps.slice(0, 3);
    while (methodSteps.length < 3) {
      methodSteps.push('재료가 고르게 익고 수분이 알맞게 줄어들 때까지 약불에서 한 번 더 정리합니다.');
    }
    stepsList.innerHTML = methodSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const seasoningStep = document.createElement('li');
    seasoningStep.innerHTML = `<strong>간 맞춤:</strong> ${escapeHtml(getSeasoningTip(recipe))}`;
    stepsList.appendChild(seasoningStep);
  }

}

function normalizeMypageRecipeNames() {
  document.querySelectorAll('.book-card-name').forEach((nameElement) => {
    const name = nameElement.textContent.trim();
    if (name === '덮밥' || name === '돼지고기덮밥' || name === '돼지고기 덮밥') {
      nameElement.textContent = '돼지고기 덮밥';
    }
  });
}

function resetRecommendationFiltersForMenu() {
  selectedPreferences.clear();
  selectedCuisines.clear();
  recipeSearchQuery = '';
  activeDifficultyFilter = 'all';
  recipePage = 1;
  state.recipeCardDisplayMode = 'one';
  state.currentCarouselIndex = 0;

  // 다음 취향 추천을 열었을 때 이전에 눌렀던 칩이 다시 선택된 것처럼 남지 않게 합니다.
  document.querySelectorAll('#taste-modal .chip-btn.active').forEach((chip) => {
    chip.classList.remove('active');
    chip.setAttribute('aria-pressed', 'false');
  });
}

function syncRenderedView() {
  if (state.route === 'recipes') {
    if (state.recipeViewMode === 'menu' && lastRecipeViewMode !== 'menu') {
      resetRecommendationFiltersForMenu();
      lastRecipeViewMode = 'menu';
      render();
      return;
    }

    lastRecipeViewMode = state.recipeViewMode;
    if (state.recipeViewMode === 'menu'
      && !document.getElementById('app')?.querySelector('[data-recipe-overview]')) {
      applyRecipeFilters();
      decorateRecipeCard();
    } else if (state.recipeViewMode !== 'menu') {
      decorateCarouselView();
    }
    return;
  }
  if (state.route === 'detail') decorateDetailPage();
  if (state.route === 'mypage') normalizeMypageRecipeNames();
}

export function initRecommend() {
  addCuisineChoices();
  lastRecipeViewMode = state.recipeViewMode;

  document.addEventListener('click', (event) => {
    queueMicrotask(() => syncRenderedView());
    // 다른 모듈의 상세 화면 렌더가 끝난 뒤에도 제목 보정을 한 번 더 적용합니다.
    setTimeout(() => syncRenderedView(), 0);

    const recipesNavigation = event.target.closest('[data-nav="recipes"]');
    if (recipesNavigation) {
      resetRecommendationFiltersForMenu();
      lastRecipeViewMode = null;
    }

    const recipeDisplayButton = event.target.closest('[data-recipe-display]');
    if (recipeDisplayButton) {
      state.recipeCardDisplayMode = recipeDisplayButton.dataset.recipeDisplay;
      if (state.recipeCardDisplayMode === 'three') {
        state.currentCarouselIndex = Math.floor(state.currentCarouselIndex / 3) * 3;
      }
      state.preserveRecipeResults = true;
      render();
      decorateCarouselView();
      return;
    }

    const recipeInsightButton = event.target.closest('[data-recipe-insight-start]');
    if (recipeInsightButton && state.route === 'detail') {
      const recipe = state.carouselRecipes?.find((item) => item.id === state.currentDetail)
        || [...RECIPES, ...ALTERNATIVE_RECIPES].find((item) => item.id === state.currentDetail);
      const detailContainer = recipeInsightButton.closest('.detail-container');
      if (recipe && detailContainer) startRecipeInsight(recipe, detailContainer);
      return;
    }

    const multiViewDetailButton = event.target.closest('.recipe-detail-btn[data-rid]');
    if (multiViewDetailButton && multiViewDetailButton.id !== 'btn-view-steps') {
      navigate('detail', multiViewDetailButton.dataset.rid);
      return;
    }

    const resetRecipeFilters = event.target.closest('#btn-reset-recipe-filters');
    if (resetRecipeFilters) {
      selectedPreferences.clear();
      selectedCuisines.clear();
      recipeSearchQuery = '';
      activeDifficultyFilter = 'all';
      state.showingAlternatives = false;
      state.recipeSource = 'all';
      state.recipeViewMode = 'menu';
      refreshRecipeResults();
      return;
    }

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
      if (tasteClose) {
        // 1. 모달 내 활성화된 모든 칩 active 클래스 제거
        document.querySelectorAll('#taste-modal .chip-btn').forEach((chip) => {
          chip.classList.remove('active');
        });
        // 2. 필터 데이터 비우기
        selectedPreferences.clear();
        selectedCuisines.clear();
      } else if (tasteSuggest) {
        const tasteModal = document.getElementById('taste-modal');
        if (tasteModal) {
          tasteModal.classList.remove('show');
        }
        rememberTasteChoices();
        state.recipeViewMode = 'carousel';
        state.recipeCardDisplayMode = 'one';
        state.currentCarouselIndex = 0;
      }
      navigate('recipes');
      if (tasteSuggest) {
        // navigate()가 기본 추천 목록을 다시 계산하므로 취향/부족 재료를 재적용합니다.
        applyRecipeFilters();
        render();
      }
      return;
    }

    // 취향 및 상황 칩 버튼 선택 토글 UI 조작
    const cuisineChip = event.target.closest('[data-cuisine]');
    if (cuisineChip) {
      const cuisine = cuisineChip.dataset.cuisine;
      if (selectedCuisines.has(cuisine)) selectedCuisines.delete(cuisine);
      else selectedCuisines.add(cuisine);
      cuisineChip.classList.toggle('active', selectedCuisines.has(cuisine));
      return;
    }

    const cuisineFilter = event.target.closest('[data-cuisine-filter]');
    if (cuisineFilter) {
      const cuisine = cuisineFilter.dataset.cuisineFilter;
      selectedCuisines.clear();
      if (cuisine !== 'all') selectedCuisines.add(cuisine);
      state.showingAlternatives = cuisine === '편의점';
      state.recipeSource = cuisine === 'all'
        ? 'all'
        : cuisine === '편의점'
          ? 'alternative'
          : 'normal';
      refreshRecipeResults();
      return;
    }

    const difficultyFilter = event.target.closest('[data-difficulty-filter]');
    if (difficultyFilter) {
      activeDifficultyFilter = difficultyFilter.dataset.difficultyFilter;
      refreshRecipeResults();
      return;
    }

    const overviewRecipe = event.target.closest('[data-overview-recipe]');
    if (overviewRecipe) {
      state.detailBackRoute = 'recipes';
      navigate('detail', overviewRecipe.dataset.overviewRecipe);
      return;
    }

    const pageButton = event.target.closest('[data-recipe-page]');
    if (pageButton) {
      const pageCount = Math.max(1, Math.ceil(state.carouselRecipes.length / 10));
      recipePage = Math.max(1, Math.min(pageCount, recipePage + (pageButton.dataset.recipePage === 'next' ? 1 : -1)));
      render(); // 동기적으로 render 호출하면 app.js의 render 내에서 자동으로 그리드가 다시 그려짐!
      return;
    }

    const chip = event.target.closest('.chip-btn');
    if (chip) {
      chip.classList.toggle('active');
      return;
    }

    const searchInput = event.target.closest('[data-recipe-search]');
    if (searchInput) return;

    if (event.target.closest('#btn-dislike-recipe')) {
      state.showingAlternatives = !state.showingAlternatives;
      state.recipeSource = state.showingAlternatives ? 'alternative' : 'normal';
      state.recipeViewMode = 'carousel';
      window.__routingActive = true; // 편의점 레시피 전환 시 우아한 실크 페이드 유도
      refreshRecipeResults();
      showToast(state.showingAlternatives
        ? '편의점 꿀조합 레시피를 불러왔어요!'
        : '일반 맞춤 추천 레시피로 돌아왔어요.');
      return;
    }

  });
  document.addEventListener('input', (event) => {
    const searchInput = event.target.closest('[data-recipe-search]');
    if (!searchInput) return;
    if (isSearchComposing) return;
    scheduleRecipeSearch(searchInput);
  });

  document.addEventListener('compositionstart', (event) => {
    if (event.target.closest('[data-recipe-search]')) isSearchComposing = true;
  });

  document.addEventListener('compositionend', (event) => {
    const searchInput = event.target.closest('[data-recipe-search]');
    if (!searchInput) return;
    isSearchComposing = false;
    scheduleRecipeSearch(searchInput);
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
