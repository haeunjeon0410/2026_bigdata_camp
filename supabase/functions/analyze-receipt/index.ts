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

    const prompt = `이 영수증 이미지를 분석해서 구매한 식재료 항목을 추출해줘.

각 항목마다 다음 정보를 포함해:
- rawName: 영수증에 실제로 인쇄된 원본 상품명 그대로
- normalizedName: 일반적으로 통용되는 재료 이름으로 정규화한 이름 (예: "신선대란 10입" -> "계란")
- quantity: 수량 (예: "1팩", "2개", "500g")

식재료가 아닌 항목(비닐봉투, 배송비, 할인, 포인트 적립 등)은 제외해줘.
반드시 아래 JSON 형식으로만 응답하고, 다른 설명은 붙이지 마:
{"items": [{"rawName": "...", "normalizedName": "...", "quantity": "..."}]}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
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
