import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = { getItem: () => "ko", setItem() {} };
const { spark } = await import("../gateway/app/agent_static/charts.mjs");

test("소형 추세선은 값이 둘 이상이고 전부 0이 아닐 때만 그린다", () => {
  assert.equal(spark([]), "");
  assert.equal(spark([4]), "");
  assert.equal(spark([0, 0, 0]), "");
  const svg = spark([1, 5, 3, 8]);
  assert.match(svg, /^<svg class="spark"[^>]*aria-hidden="true"><polyline points="[\d., ]+"/);
  assert.equal(svg.match(/\d+\.\d+,\d+\.\d+/g).length, 4);
});

test("소형 추세선은 가장 큰 값을 위쪽에 둔다", () => {
  const points = spark([1, 9]).match(/points="([^"]+)"/)[1].split(" ").map((p) => Number(p.split(",")[1]));
  assert.ok(points[1] < points[0]);
});
