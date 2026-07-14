//------------------------------------
// 담당 : 채린
// 수정 가능
//------------------------------------
/* 데이터 조회 모듈 */

export const INGREDIENTS = [
  {id:'egg', name:'계란', emoji:'🥚', category:'dairy'},
  {id:'milk', name:'우유', emoji:'🥛', category:'dairy'},
  {id:'cheese', name:'치즈', emoji:'🧀', category:'dairy'},
  
  {id:'potato', name:'감자', emoji:'🥔', category:'vegetable'},
  {id:'onion', name:'양파', emoji:'🧅', category:'vegetable'},
  {id:'tomato', name:'토마토', emoji:'🍅', category:'vegetable'},
  {id:'cabbage', name:'양배추', emoji:'🥬', category:'vegetable'},
  {id:'carrot', name:'당근', emoji:'🥕', category:'vegetable'},
  {id:'broccoli', name:'브로콜리', emoji:'🥦', category:'vegetable'},
  {id:'garlic', name:'마늘', emoji:'🧄', category:'vegetable'},
  {id:'pepper', name:'고추', emoji:'🌶️', category:'vegetable'},
  {id:'mushroom', name:'버섯', emoji:'🍄', category:'vegetable'},
  {id:'greenonion', name:'대파', emoji:'🌿', category:'vegetable'},
  
  {id:'bacon', name:'베이컨', emoji:'🥓', category:'meat'},
  
  {id:'rice', name:'밥', emoji:'🍚', category:'grain'},
  {id:'bread', name:'빵', emoji:'🍞', category:'grain'},
];

export const CATEGORIES = {
  all: { name: '전체', emoji: '✨' },
  dairy: { name: '유제품·달걀', emoji: '🥚' },
  vegetable: { name: '채소·과일', emoji: '🥦' },
  meat: { name: '고기·가공품', emoji: '🥓' },
  grain: { name: '곡류·식사', emoji: '🍞' }
};

export const RECIPES = [
  {
    id:'r1', name:'감자전', emoji:'🥞', difficulty:'쉬움', time:'20분',
    need:['potato','onion','egg'], missing:['부침가루','식용유'],
    aiReason:'냉장고에 감자와 양파가 넉넉해서 바삭한 감자전을 추천했어요!',
    ingredients:['감자 2개','양파 1/2개','계란 1개','부침가루 3T','식용유 약간','소금 약간'],
    steps:['감자와 양파를 강판에 갈거나 아주 얇게 채썰어줍니다.','계란과 부침가루를 넣고 소금으로 살짝 간을 한 후 잘 섞어 반죽을 만들어요.','팬에 식용유를 넉넉하게 두르고 온도가 오를 때까지 기다립니다.','반죽을 먹기 좋은 크기로 둥글게 올려 앞뒤로 노릇하게 구워 완성합니다.'],
    cookingSequence: ['🥔', '🔪', '🍳', '🥞']
  },
  {
    id:'r2', name:'소박한 감자볶음', emoji:'🍳', difficulty:'쉬움', time:'15분',
    need:['potato','onion','carrot'], missing:['식용유'],
    aiReason:'포실포실한 감자와 아삭한 당근, 양파의 조화가 훌륭해요.',
    ingredients:['감자 2개','당근 1/2개','양파 1/2개','식용유','소금','후추'],
    steps:['감자, 양파, 당근을 얇게 채썰어 준비합니다. 채썬 감자는 물에 헹구어 전분기를 빼면 더 달라붙지 않아요.','달군 팬에 기름을 넉넉히 두르고 단단한 감자를 먼저 볶아줍니다.','감자가 투명해지기 시작하면 당근과 양파를 넣고 중불에서 함께 볶볶!','소금와 후추로 간을 맞추고 통깨를 솔솔 뿌려서 완성합니다.'],
    cookingSequence: ['🥔', '🔪', '🍳', '🥗']
  },
  {
    id:'r3', name:'돌돌 계란말이', emoji:'🍱', difficulty:'보통', time:'15분',
    need:['egg', 'carrot', 'greenonion'], missing:['식용유'],
    aiReason:'단백질 가득! 밥반찬으로 부드럽고 든든한 계란말이에요.',
    ingredients:['계란 3개','당근 약간','대파 약간','소금','식용유'],
    steps:['볼에 계란을 풀고 고운 소금 두 꼬집을 넣은 뒤 곱게 풀어줍니다.','잘게 다진 당근과 대파를 넣어 골고루 섞어줍니다.','팬에 기름을 얇게 코팅하듯 두르고 약불에서 계란물의 1/3을 채워 굽습니다.','살짝 익었을 때 끝에서부터 돌돌 말아가며 남은 계란물을 채워가며 도톰하게 말아줍니다.','완성된 계란말이를 한 김 식힌 매끈한 상태에서 예쁘게 썰어냅니다.'],
    cookingSequence: ['🥚', '🌿', '🍳', '🍱']
  },
  {
    id:'r4', name:'치즈 듬뿍 토스트', emoji:'🥪', difficulty:'쉬움', time:'10분',
    need:['bread','egg','cheese'], missing:[],
    aiReason:'바쁜 아침, 빵과 끈적한 치즈가 순식간에 에너지를 채워줄 거예요.',
    ingredients:['식빵 2장','계란 1개','치즈 1장','버터 약간'],
    steps:['달군 달팽이 팬에 버터를 올려 녹여 풍미를 연출합니다.','식빵 두 장을 앞뒤로 노릇하게 구워 바삭함을 살려줍니다.','계란을 프라이 형태로 굽고 한쪽 식빵 위에 계란과 슬라이스 치즈를 올립니다.','다른 식빵으로 덮은 후 치즈가 살짝 녹았을 때 꺼내 반으로 잘라 먹습니다.'],
    cookingSequence: ['🍞', '🧀', '🍳', '🥪']
  },
  {
    id:'r5', name:'자취생 카레라이스', emoji:'🍛', difficulty:'보통', time:'30분',
    need:['potato','onion','carrot','rice'], missing:['카레가루'],
    aiReason:'냉장고 속 구황작물 대방출! 한 번 해두면 3일은 든든한 효자 요리!',
    ingredients:['감자 1개','양파 1개','당근 1/2개','카레가루 1팩','밥 1공기','물 2컵'],
    steps:['감자, 당근, 양파를 한입 크기로 깍둑썰기 해줍니다.','깊은 팬에 기름이나 버터를 두르고 단단한 감자, 당근부터 볶다가 양파를 넣어요.','양파가 투명해지면 물을 넣고 센 불에 한소끔 끓여 모든 재료를 푹 익힙니다.','약불로 줄인 뒤 카레 가루를 조금씩 풀어 넣고 주걱으로 저으며 걸쭉하게 끓입니다.','따뜻한 밥 위에 카레 소스를 듬뿍 얹어 마무리합니다.'],
    cookingSequence: ['🥔', '🧅', '🍳', '🍛']
  },
  {
    id:'r6', name:'아삭 양배추쌈밥', emoji:'🥬', difficulty:'쉬움', time:'15분',
    need:['cabbage','rice'], missing:['쌈장'],
    aiReason:'다이어트와 위 건강을 챙겨줄 양배추의 산뜻한 변신!',
    ingredients:['양배추 잎 5장','밥 1공기','쌈장 약간'],
    steps:['양배추 잎을 낱장으로 뜯어 깨끗이 씻은 후 찜기 혹은 전자레인지에 3~4분 쪄줍니다.','찐 양배추는 찬물에 헹궈 아삭함을 잡아주고 물기를 꼭 짜서 둡니다.','데친 양배추를 넓게 펴고 따뜻한 밥 한 숟가락을 단단히 뭉쳐 얹어줍니다.','쌈장을 콩알만큼 얹어 예쁘게 도톰하게 말아서 쌈밥을 완성합니다.'],
    cookingSequence: ['🥬', '🍚', '🔪', '🥗']
  }
];

export const ALTERNATIVE_RECIPES = [
  {
    id: 'alt1',
    name: '마크정식',
    emoji: '🍝',
    difficulty: '쉬움',
    time: '10분',
    need: ['cheese'],
    missing: ['자이언트 떡볶이', '콕콕콕 스파게티', '프랑크 소시지'],
    aiReason: '편의점 마니아라면 모를 수 없는 그 레시피! 극락의 단짠 조합입니다.',
    ingredients: ['자이언트 떡볶이 1개', '콕콕콕 스파게티 1개', '프랑크 소시지 1개', '스트링 치즈 1~2개'],
    steps: [
      '자이언트 떡볶이를 조리법대로 끓이고, 스파게티 컵라면은 면만 익혀 스프를 넣고 비벼줍니다.',
      '떡볶이 용기에 조리된 스파게티 면과 소스를 쏟아붓고 섞어줍니다.',
      '소시지를 한입 크기로 슬라이스해서 올리고 스트링 치즈를 찢어서 고루 얹어줍니다.',
      '전자레인지에 약 1분 30초 돌려 치즈를 완전히 녹인 뒤 잘 저어 먹습니다.'
    ],
    cookingSequence: ['🍝', '🧀', '🍳', '😋'],
    priceList: [
      { name: '자이언트 떡볶이', price: 3200 },
      { name: '콕콕콕 스파게티', price: 1600 },
      { name: '프랑크 소시지', price: 2500 },
      { name: '스트링 치즈 1개', price: 1300 }
    ],
    totalPrice: 8600
  },
  {
    id: 'alt2',
    name: '불닭치즈삼김밥',
    emoji: '🍙',
    difficulty: '쉬움',
    time: '5분',
    need: ['cheese', 'rice'],
    missing: ['불닭볶음면', '참치마요 삼각김밥'],
    aiReason: '매콤한 맛과 고소한 참치마요 삼김이 만나 완벽한 한 끼가 됩니다!',
    ingredients: ['불닭볶음면 컵라면 1개', '참치마요 삼각김밥 1개', '스트링 치즈 1장'],
    steps: [
      '불닭볶음면을 익혀 물을 따라버리고 소스를 넣어 비벼줍니다.',
      '면을 조금 남기거나 가위로 잘게 자른 뒤 참치마요 삼각김밥을 김째 부수어 넣습니다.',
      '위에 스트링치즈를 얹은 뒤 전자레인지에 1분간 가동합니다.',
      '치즈가 녹으면 삼각김밥과 면, 불닭 소스를 골고루 비벼 맛있게 떠먹습니다.'
    ],
    cookingSequence: ['🍙', '🧀', '🍳', '🌶️'],
    priceList: [
      { name: '불닭볶음면 컵라면', price: 1800 },
      { name: '참치마요 삼각김밥', price: 1200 },
      { name: '스트링 치즈 1개', price: 1300 }
    ],
    totalPrice: 4300
  },
  {
    id: 'alt3',
    name: '신세개 라면',
    emoji: '🍜',
    difficulty: '쉬움',
    time: '8분',
    need: ['egg', 'greenonion'],
    missing: ['라면 1봉지', '쌈장 반스푼'],
    aiReason: '집에 쌈장이 남으셨나요? 고깃집에서 먹던 깊은 구수의 극치 라면 맛이 납니다.',
    ingredients: ['국물형 신라면 1봉지', '쌈장 1/2큰술', '대파 약간', '계란 1개'],
    steps: [
      '물 500ml에 라면 건더기/분말 스프와 함께 쌈장 반스푼을 풀고 물을 끓입니다.',
      '물이 끓으면 라면 면발을 넣고 4분간 꼬들하게 끓여냅니다.',
      '마지막 1분 전, 어슷 썬 대파와 계란을 퐁당 깨뜨려 넣어 한소끔 끓여 마무리합니다.'
    ],
    cookingSequence: ['🍜', '🧄', '🍳', '🔥'],
    priceList: [
      { name: '신라면 1봉지', price: 1000 },
      { name: '날계란 1개', price: 500 },
      { name: '쌈장 / 대파 (찬장재료)', price: 0 }
    ],
    totalPrice: 1500
  },
  {
    id: 'alt4',
    name: '치즈짜파구리',
    emoji: '🍲',
    difficulty: '쉬움',
    time: '10분',
    need: ['cheese'],
    missing: ['신라면 1봉지', '짜파게티 1봉지'],
    aiReason: '기생충에 소개된 짜파구리에 고소한 치즈를 더해 더 걸쭉하고 맛있게 즐겨봐요.',
    ingredients: ['짜파게티 1봉지', '신라면 1봉지', '슬라이스 노랑 치즈 2장'],
    steps: [
      '냄비에 물을 끓이고 짜파게티 면과 신라면 면, 후레이크를 모두 넣어 익힙니다.',
      '면이 적당히 익으면 종이컵 1/2컵 분량의 물만 남기고 따라 냅니다.',
      '짜장 스프 1팩 and 신라면 스프 1/2팩을 넣고 약불에서 소스가 고루 배도록 볶습니다.',
      '완성된 짜구리 위에 치즈 2장을 올린 뒤 남은 열기로 촉촉히 녹여 비벼 먹습니다.'
    ],
    cookingSequence: ['🍲', '🧀', '🍳', '👌'],
    priceList: [
      { name: '짜파게티 1봉지', price: 1200 },
      { name: '신라면 1봉지', price: 1000 },
      { name: '슬라이스 노란 치즈 2장', price: 1000 }
    ],
    totalPrice: 3200
  },
  {
    id: 'alt5',
    name: '허니버터칩 감자전',
    emoji: '🥔',
    difficulty: '쉬움',
    time: '12분',
    need: ['cheese', 'bacon'],
    missing: ['허니버터칩 1봉지'],
    aiReason: '감자 가는 게 귀찮을 때! 허니버터 감자칩으로 순식간에 달콤 바삭한 감자전을 만들어요.',
    ingredients: ['허니버터 감자칩 1봉지', '피자치즈 1컵', '베이컨 약간 (생략가능)'],
    steps: [
      '감자칩 봉지를 뜯어 감자조각을 손으로 거칠게 으깨어 줍니다.',
      '으깬 감자칩을 볼에 고루 넣고, 치즈와 소량의 시원한 베이컨 조각을 넣고 버무립니다.',
      '기름을 두르지 않은 팬에 버무린 감자칩 반죽을 넓적하고 두껍게 올려 약불로 굽습니다.',
      '치즈가 녹아 감자칩들이 서로 붙으면 조심스레 뒤집어 노릇하게 양면을 마감해줍니다.'
    ],
    cookingSequence: ['🥔', '🧀', '🍳', '🧈'],
    priceList: [
      { name: '허니버터칩 감자칩', price: 1700 },
      { name: '모짜렐라 피자 치즈', price: 1500 },
      { name: '편의점 베이컨 약간', price: 2000 }
    ],
    totalPrice: 5200
  },
  {
    id: 'alt6',
    name: '컵 계란빵',
    emoji: '🍞',
    difficulty: '쉬움',
    time: '7분',
    need: ['bread', 'egg', 'cheese'],
    missing: ['종이컵'],
    aiReason: '핫케이크 가루 없이 식빵 한 장과 전자레인지만으로 계란빵의 맛을 완벽 재현합니다.',
    ingredients: ['식빵 1장', '계란 1개', '모짜렐라 치즈 1T', '소금 한 꼬집', '설탕 약간'],
    steps: [
      '깨끗한 종이컵 내부에 식용유나 버터를 얇게 발라 달라붙음을 방지해 줍니다.',
      '식빵을 잘게 뜯거나 가위로 네모나게 큐브 모양으로 썰어 종이컵 1/3 높이까지 담습니다.',
      '그 위에 계란 1개를 톡 터뜨려 올리고 노른자를 이쑤시개 등으로 꼭 콕 찔러 폭발을 방지합니다.',
      '소금과 설탕으로 간을 맞춘 뒤 치즈를 가득 얹어 전자레인지에 1분 30초~2분 돌려 줍니다.'
    ],
    cookingSequence: ['🍞', '🥚', '🍳', '⚡'],
    priceList: [
      { name: '식빵 1장 (환산가)', price: 400 },
      { name: '날계란 1개', price: 500 },
      { name: '피자 치즈 1T', price: 500 }
    ],
    totalPrice: 1400
  }
];

/** 기본 재료 데이터를 반환합니다. */
export function getIngredients() {
  return INGREDIENTS;
}

/** 기본 레시피 데이터를 반환합니다. */
export function getRecipes() {
  return RECIPES;
}

/** 대체 레시피 데이터를 반환합니다. */
export function getAlternativeRecipes() {
  return ALTERNATIVE_RECIPES;
}

/** 재료 ID로 재료를 조회합니다. */
export function findIngredient(ingredientId) {
  return getIngredients().find((ingredient) => ingredient.id === ingredientId);
}

/** 레시피 ID로 레시피를 조회합니다. */
export function findRecipe(recipeId) {
  return [...getRecipes(), ...getAlternativeRecipes()]
    .find((recipe) => recipe.id === recipeId);
}
