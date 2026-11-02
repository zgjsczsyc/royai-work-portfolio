import { assert, validDate, CATEGORIES } from './domain.mjs';
export function evaluateReview(review, analysis) {
  assert(analysis?.mode === 'real', '人工验收只接受真实分析');
  assert(typeof review.reviewer === 'string' && review.reviewer.trim() && validDate(review.reviewedAt), '需要复核人和复核日期');
  const items = review.items;
  assert(Array.isArray(items) && items.length >= 60, '至少需要 60 条人工复核样本');
  const posts = new Map(analysis.posts.map(p => [p.id, p]));
  const seen = new Set();
  for (const item of items) {
    assert(item.humanReviewed === true && posts.has(item.postId) && !seen.has(item.postId), '复核样本必须逐条确认、在当前分析内且不重复'); seen.add(item.postId);
    assert(item.expectedProduct?.trim() && item.expectedEvent?.trim() && item.expectedCategories?.length && item.expectedCategories.every(c => CATEGORIES.includes(c)), '人工标注缺少产品、事件或合法分类');
  }
  assert(new Set(items.map(i => posts.get(i.postId).platform)).size === 3, '样本应覆盖三个平台');
  assert(['热门新游', '电竞赛事'].every(c => items.filter(i => i.expectedCategories.includes(c)).length >= 10), '新游和电竞各需要至少 10 条');
  const predictions = new Map();
  for (const event of analysis.events) for (const e of event.evidence) {
    if (!predictions.has(e.postId)) predictions.set(e.postId, []);
    predictions.get(e.postId).push(event);
  }
  let productCorrect = 0, categoryCorrect = 0;
  for (const item of items) {
    const events = predictions.get(item.postId) ?? [];
    if (events.some(e => e.product === item.expectedProduct)) productCorrect++;
    const cats = new Set(events.flatMap(e => e.categories));
    if (cats.size === item.expectedCategories.length && item.expectedCategories.every(c => cats.has(c))) categoryCorrect++;
  }
  let checkedPairs = 0, badPairs = 0;
  const byId = new Map(items.map(i => [i.postId, i]));
  for (const event of analysis.events) {
    const members = event.evidence.map(e => byId.get(e.postId)).filter(Boolean);
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
      checkedPairs++; if (members[i].expectedEvent !== members[j].expectedEvent) badPairs++;
    }
  }
  const productAccuracy = productCorrect / items.length, categoryAccuracy = categoryCorrect / items.length;
  const falseMergeRate = checkedPairs ? badPairs / checkedPairs : null;
  return { total: items.length, reviewer: review.reviewer, reviewedAt: review.reviewedAt, productAccuracy, categoryAccuracy, falseMergeRate, checkedPairs,
    passed: productAccuracy >= .9 && categoryAccuracy >= .8 && falseMergeRate !== null && falseMergeRate <= .1 };
}
