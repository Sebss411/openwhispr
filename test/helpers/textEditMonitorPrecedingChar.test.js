const test = require("node:test");
const assert = require("node:assert/strict");

const TextEditMonitor = require("../../src/helpers/textEditMonitor");

test("getPrecedingChar resolves to unknown when no pid is provided", async () => {
  const m = new TextEditMonitor();
  const result = await m.getPrecedingChar(null);
  assert.deepEqual(result, { state: "unknown" });
});

test("getPrecedingChar resolves to unknown for pid=0", async () => {
  const m = new TextEditMonitor();
  const result = await m.getPrecedingChar(0);
  assert.deepEqual(result, { state: "unknown" });
});

test("getPrecedingChar respects timeout and returns unknown on hang", async () => {
  if (process.platform !== "darwin") {
    // On non-mac, the function returns "unknown" synchronously without
    // shelling out — nothing to time out. Skip the timing assertion.
    const m = new TextEditMonitor();
    const result = await m.getPrecedingChar(99999);
    assert.deepEqual(result, { state: "unknown" });
    return;
  }
  const m = new TextEditMonitor();
  // PID that almost certainly doesn't exist as a running app; osascript will
  // error and we should get unknown — quickly.
  const start = Date.now();
  const result = await m.getPrecedingChar(99999999, 1500);
  const elapsed = Date.now() - start;
  assert.equal(result.state, "unknown");
  assert.ok(elapsed < 3000, `Expected fast resolution, got ${elapsed}ms`);
});
