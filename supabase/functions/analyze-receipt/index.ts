// analyze-receipt Edge Function
// 영수증 이미지를 받아 OpenAI Vision API로 분석하고, 식재료 항목을 JSON으로 반환합니다.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 허용됩니다." }, 405);
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY가 Supabase Secret에 설정되어 있지 않습니다.");
      return jsonResponse({ error: "서버 설정 오류입니다. 관리자에게 문의해주세요." }, 500);
    }

    // multipart/form-data에서 receipt 이미지 추출
    const formData = await req.formData();
    const receiptFile = formData.get("receipt");

    if (!receiptFile || !(receiptFile instanceof File)) {
      return jsonResponse({ error: "receipt 이미지 파일이 필요합니다." }, 400);
    }

    // 이미지 크기 제한 (10MB)
    if (receiptFile.size > 10 * 1024 * 1024) {
      return jsonResponse({ error: "이미지 파일이 너무 큽니다. (최대 10MB)" }, 400);
    }

    // 이미지를 base64로 인코딩
    const arrayBuffer = await receiptFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = receiptFile.type || "image/jpeg";

    const prompt = `너는 영수증 OCR 분석기다. 이미지에 실제로 보이는 글자만 읽고 구매 상품을 추출해.

중요한 규칙:
1. 영수증의 상품명은 위에서 아래 순서대로 빠짐없이 읽어라.
2. 글자가 불명확하면 추측하거나 비슷한 상품으로 바꾸지 말고, 보이는 부분을 rawName에 그대로 적어라.
3. rawName은 영수증에 인쇄된 상품명을 최대한 그대로 적어라. 브랜드명과 규격도 유지해라.
4. normalizedName은 실제 상품을 대표하는 일반 재료명으로만 정규화해라.
   예: "신선대란 10입" -> "계란", "서울우유 1L" -> "우유", "감자칩" -> "감자칩".
   상품을 다른 재료로 바꾸거나, 이미지에 없는 재료를 만들어내지 마라.
5. quantity는 영수증에 표시된 수량/중량을 적고, 없으면 빈 문자열로 둬라.
6. 비닐봉투, 배송비, 할인, 포인트, 결제금액 같은 비식품 항목은 제외해라.

반드시 아래 JSON 형식으로만 응답해:
{"items": [{"rawName": "실제 상품명", "normalizedName": "일반 재료명", "quantity": "수량 또는 중량"}]}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI API 오류:", openaiResponse.status, errText);
      return jsonResponse({ error: "영수증 분석 중 오류가 발생했습니다." }, 502);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("OpenAI 응답에 content가 없습니다:", JSON.stringify(openaiData));
      return jsonResponse({ error: "분석 결과를 받지 못했습니다.", items: [] }, 502);
    }

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON 파싱 실패. 원본 응답:", content);
      return jsonResponse({ error: "분석 결과 형식이 올바르지 않습니다.", items: [] }, 502);
    }

    return jsonResponse({ items: parsed.items ?? [] }, 200);
  } catch (error) {
    console.error("analyze-receipt 처리 중 예외 발생:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "알 수 없는 오류입니다." },
      500,
    );
  }
});
