# AI 에이전트 기능 정리

## 1. 구현 여부

본 프로젝트에는 영수증 이미지를 분석하는 AI 기능이 구현되어 있습니다.

다만 사용자의 요청을 스스로 계획하고 여러 도구를 반복 실행하는 자율형 에이전트라기보다는, OpenAI Vision API를 호출해 영수증 상품을 추출하는 AI 분석 기능입니다.

## 2. 기능 개요

- 기능명: 영수증 이미지 분석 및 냉장고 재료 등록
- 입력: 사용자가 업로드한 영수증 이미지
- AI 모델: OpenAI `gpt-4o-mini`
- 처리 위치: Supabase Edge Function
- 결과: 상품명, 일반 재료명, 수량을 JSON으로 반환
- 후속 처리: 사용자가 분석 결과를 확인하고 선택한 재료를 냉장고 목록에 추가

## 3. 동작 흐름

1. 사용자가 영수증 이미지를 업로드합니다.
2. 프론트엔드가 Supabase `analyze-receipt` Edge Function을 호출합니다.
3. Edge Function이 이미지를 Base64로 변환해 OpenAI Vision API에 전달합니다.
4. AI가 영수증의 식품 상품을 추출하고 `items` JSON으로 응답합니다.
5. 프론트엔드가 결과를 정규화하고 중복 상품을 제거합니다.
6. 사용자가 추가할 상품을 선택하면 냉장고 재료 목록에 등록합니다.

## 4. 관련 파일

- `supabase/functions/analyze-receipt/index.ts`: OpenAI Vision API 호출 및 결과 JSON 반환
- `js/supabase.js`: Supabase Edge Function 호출 어댑터
- `js/receipt.js`: 영수증 업로드, 분석 상태 표시, 결과 선택 및 등록 처리
- `js/ingredient.js`: 분석된 재료의 냉장고 등록 처리

## 5. 보안 및 오류 처리

- OpenAI API 키는 클라이언트에 노출하지 않고 Supabase Secret `OPENAI_API_KEY`로 관리합니다.
- 영수증 이미지 크기는 최대 10MB로 제한합니다.
- 이미지에 보이지 않는 상품을 추측하지 않도록 분석 프롬프트에 제한을 둡니다.
- 비식품 항목, 할인, 배송비, 결제금액 등은 결과에서 제외하도록 요청합니다.
- OpenAI 오류, JSON 파싱 오류, 빈 분석 결과에 대해 사용자 오류 상태를 표시합니다.

## 6. 제출 기준 Git 정보

- 작업 브랜치: `chaerinkang`
- 현재 HEAD 커밋: `9f3e0de`
- 원격 브랜치: `origin/chaerinkang`
- 현재 로컬 브랜치는 원격 `origin/chaerinkang`보다 3개 커밋 앞서 있습니다.

### AI 기능 관련 커밋

- `3ea3ba8` — `feat: add receipt analysis edge function`
- `827af8a` — `영수증 연동`
- `85000da` — `Update receipt analysis flow`

현재 브랜치의 최신 커밋까지 포함해 제출할 경우 최종 제출 식별자는 `9f3e0de`입니다.

## 7. 실행에 필요한 설정

Supabase Edge Function 환경 변수에 다음 Secret을 설정해야 실제 AI 분석이 동작합니다.

```text
OPENAI_API_KEY=실제 OpenAI API 키
```

Supabase 연결 정보가 없거나 API Secret이 설정되지 않은 환경에서는 실제 분석을 수행할 수 없습니다.

## 8. 기능 추가 필요 여부

현재 요구사항이 “AI 에이전트 기능 구현 여부와 작업 내역 제출”이라면 추가 기능 없이도 제출 가능한 상태입니다.

현재 구현은 AI 기반 영수증 분석 기능이며, 자율형 에이전트임을 명확히 요구받는 경우에만 다음과 같은 확장을 검토할 수 있습니다.

- 분석 결과에 따라 자동으로 재료를 분류하고 저장 위치를 결정하는 단계
- 보유 재료를 바탕으로 레시피를 선택하고 추천 이유를 생성하는 단계
- 여러 단계의 도구 호출과 실패 재시도, 사용자 확인을 포함하는 에이전트 흐름

