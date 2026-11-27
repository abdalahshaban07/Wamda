const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  fresh,
  parseState,
  readState,
  writeState,
  STORAGE_KEY,
} = require("./unit/state");
test("valid state roundtrip preserves collections language likes saved", () => {
  const s = fresh();
  s.lang = "en";
  s.collections.push({ id: "a", name: "Architecture" });
  s.likes = ["space"];
  s.saved = { space: "a" };
  assert.deepEqual(parseState(JSON.stringify(s)), s);
});
test("invalid JSON is kept without writing", () => {
  let writes = 0;
  const r = readState({ getItem: () => "{bad", setItem: () => writes++ });
  assert.equal(r.issue, "corrupt");
  assert.equal(r.raw, "{bad");
  assert.equal(writes, 0);
});
test("blocked and full storage fail explicitly", () => {
  assert.equal(
    readState({
      getItem: () => {
        throw Error();
      },
      setItem: () => {},
    }).issue,
    "unavailable",
  );
  assert.equal(
    writeState(
      {
        getItem: () => null,
        setItem: () => {
          throw Error();
        },
      },
      fresh(),
    ),
    false,
  );
});
for (const [name, change] of [
  ["wrong version", (s) => (s.version = 99)],
  ["unknown post", (s) => (s.likes = ["fake"])],
  ["duplicate like", (s) => (s.likes = ["space", "space"])],
  ["missing collection", (s) => (s.saved = { space: "gone" })],
  [
    "duplicate collection",
    (s) => s.collections.push({ id: "inbox", name: "Other" }),
  ],
  ["duplicate name", (s) => s.collections.push({ id: "other", name: "INBOX" })],
  ["long name", (s) => (s.collections[0].name = "x".repeat(41))],
  ["prototype key", (s) => (s.saved = JSON.parse('{"__proto__":"inbox"}'))],
  ["array saved", (s) => (s.saved = [])],
  ["bad language", (s) => (s.lang = "fr")],
])
  test("reject " + name, () => {
    let s = fresh();
    change(s);
    assert.throws(() => parseState(JSON.stringify(s)));
  });
test("size limit and non-object shapes", () => {
  for (const raw of ["null", "[]", "1", '"hello"', " ".repeat(200001)])
    assert.throws(() => parseState(raw));
});
