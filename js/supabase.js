//------------------------------------
// 담당 : 채린
// 설명 : Supabase 세팅 완료 시 주석을 해제하고 URL/Key를 입력하여 활성화하세요.
//------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// 1. Supabase 접속 설정 (세팅 완료 시 여기에 입력)
const SUPABASE_URL = 'https://trxvoqxuyyjyfmvpdxkx.supabase.co'; // 예: 'https://your-project.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CsMIpkJEDF3VKvKs4mfVIw_6OudaQvS'; // 예: 'your-anon-key'


export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

/** 
 * Supabase를 통해 전체 레시피 목록을 비동기 조회합니다.
 * Supabase가 활성화되지 않았을 때는 로컬 모의 데이터를 반환하여 MVP 기능이 깨지지 않게 방어합니다.
 */
export async function fetchRecipesFromSupabase(fallbackRecipes = []) {
  if (!supabase) {
    console.log('⚠️ [Supabase] 연결 정보가 없어 로컬 데이터를 사용합니다.');
    return fallbackRecipes;
  }

  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*');

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('❌ [Supabase] 레시피 로딩 실패:', err.message);
    return fallbackRecipes;
  }
}

/**
 * Supabase를 통해 전체 식재료 목록을 비동기 조회합니다.
 */
export async function fetchIngredientsFromSupabase(fallbackIngredients = []) {
  if (!supabase) {
    return fallbackIngredients;
  }

  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*');

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('❌ [Supabase] 식재료 로딩 실패:', err.message);
    return fallbackIngredients;
  }
}

/** 익명 로그인 세션을 준비합니다. 이메일 로그인이나 비밀번호가 필요 없습니다. */
export async function ensureAnonymousSession() {
  if (!supabase) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

/** 현재 익명 사용자의 즐겨찾기 목록을 조회합니다. */
export async function fetchFavoriteRows() {
  const user = await ensureAnonymousSession();
  if (!user) return null;

  const { data, error } = await supabase
    .from('favorite')
    .select('recipe_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** 현재 익명 사용자의 즐겨찾기를 추가하거나 삭제합니다. */
export async function toggleFavoriteInSupabase(recipeId, isAdding) {
  const user = await ensureAnonymousSession();
  if (!user) return { synced: false };

  if (isAdding) {
    const { error } = await supabase
      .from('favorite')
      .upsert(
        [{ user_id: user.id, recipe_id: String(recipeId) }],
        { onConflict: 'user_id,recipe_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorite')
      .delete()
      .eq('user_id', user.id)
      .eq('recipe_id', String(recipeId));
    if (error) throw error;
  }

  return { synced: true };
}

/**
 * 영수증 이미지를 analyze-receipt Edge Function에 전송해 식재료 항목을 분석합니다.
 * @param {File} imageFile - 사용자가 업로드한 영수증 이미지 파일
 * @returns {Promise<{items: Array<{rawName: string, normalizedName: string, quantity: string}>}>}
 */
export async function analyzeReceipt(imageFile) {
  if (!supabase) {
    console.log('⚠️ [Supabase] 연결 정보가 없어 영수증 분석을 수행할 수 없습니다.');
    return { items: [] };
  }

  if (!imageFile) {
    console.error('❌ [Supabase] 영수증 이미지 파일이 전달되지 않았습니다.');
    return { items: [] };
  }

  try {
    const formData = new FormData();
    formData.append('receipt', imageFile);

    const { data, error } = await supabase.functions.invoke('analyze-receipt', {
      body: formData,
    });

    if (error) throw error;
    return { items: data?.items ?? [], isDemo: false };
  } catch (err) {
    console.error('❌ [Supabase] 영수증 분석 실패:', err.message);
    throw err;
  }
}
