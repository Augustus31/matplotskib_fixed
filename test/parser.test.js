import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMN_TYPES } from "../src/contracts.js";
import { parseCsv } from "../src/parser/index.js";

/**
 * Asserts that a result has the failure shape and, optionally, that its
 * errors match a pattern.
 *
 * @param {import("../src/contracts.js").ParseResult} objResult Result to check.
 * @param {RegExp} [regexError] Pattern the joined errors must match.
 */
function assertFailure(objResult, regexError) {
  assert.deepEqual(objResult.arrColumns, []);
  assert.deepEqual(objResult.arrRows, []);
  assert.ok(objResult.arrErrors.length > 0, "expected at least one error");
  if (regexError) {
    assert.match(objResult.arrErrors.join("\n"), regexError);
  }
}

test("parses a simple table and infers column types", () => {
  const objResult = parseCsv("name,score\nAda,10\nLin,12");

  assert.deepEqual(objResult, {
    arrColumns: [
      { strField: "name", strType: COLUMN_TYPES.CATEGORY },
      { strField: "score", strType: COLUMN_TYPES.NUMBER },
    ],
    arrRows: [
      { name: "Ada", score: 10 },
      { name: "Lin", score: 12 },
    ],
    arrErrors: [],
  });
});

test("keeps the column order of the file", () => {
  const objResult = parseCsv("z,a,m\n1,2,3");

  assert.deepEqual(
    objResult.arrColumns.map((objColumn) => objColumn.strField),
    ["z", "a", "m"],
  );
});

test("trims whitespace around headers and values", () => {
  const objResult = parseCsv(" a , b \n x , 1 ");

  assert.deepEqual(objResult.arrRows, [{ a: "x", b: 1 }]);
  assert.equal(objResult.arrColumns[0].strField, "a");
});

test("recognises numeric formats", () => {
  const arrValues = ["12", "-3", "+2", "1.5", ".5", "5.", "1e3", "1.5E-2"];

  for (const strValue of arrValues) {
    const objResult = parseCsv(`n\n${strValue}`);
    assert.equal(
      objResult.arrColumns[0].strType,
      COLUMN_TYPES.NUMBER,
      strValue,
    );
    assert.equal(objResult.arrRows[0].n, Number(strValue), strValue);
  }
});

test("treats non-numeric text as a category", () => {
  const arrValues = ["1,000", "$5", "NaN", "Infinity", "0x10", "1e", "--1"];

  for (const strValue of arrValues) {
    const objResult = parseCsv(`n\n"${strValue}"`);
    assert.equal(
      objResult.arrColumns[0].strType,
      COLUMN_TYPES.CATEGORY,
      strValue,
    );
    assert.equal(objResult.arrRows[0].n, strValue, strValue);
  }
});

test("one non-numeric value makes the whole column a category", () => {
  const objResult = parseCsv("v\n1\n2\nthree");

  assert.equal(objResult.arrColumns[0].strType, COLUMN_TYPES.CATEGORY);
  assert.deepEqual(objResult.arrRows, [{ v: "1" }, { v: "2" }, { v: "three" }]);
});

test("a blank cell makes a column a category and is kept as an empty string", () => {
  const objResult = parseCsv("name,score\nAda,10\nLin,");

  assert.equal(objResult.arrColumns[1].strType, COLUMN_TYPES.CATEGORY);
  assert.deepEqual(objResult.arrRows, [
    { name: "Ada", score: "10" },
    { name: "Lin", score: "" },
  ]);
  assert.deepEqual(objResult.arrErrors, []);
});

test("boolInferTypes false makes every column a category", () => {
  const objResult = parseCsv("a\n1\n2", { boolInferTypes: false });

  assert.equal(objResult.arrColumns[0].strType, COLUMN_TYPES.CATEGORY);
  assert.deepEqual(objResult.arrRows, [{ a: "1" }, { a: "2" }]);
});

test("a header-only file has category columns and no rows", () => {
  const objResult = parseCsv("a,b\n");

  assert.deepEqual(objResult, {
    arrColumns: [
      { strField: "a", strType: COLUMN_TYPES.CATEGORY },
      { strField: "b", strType: COLUMN_TYPES.CATEGORY },
    ],
    arrRows: [],
    arrErrors: [],
  });
});

test("parses quoted fields with delimiters, escaped quotes and newlines", () => {
  const objResult = parseCsv('a,b\n"x, y","say ""hi"""\n"line1\nline2",z');

  assert.deepEqual(objResult.arrRows, [
    { a: "x, y", b: 'say "hi"' },
    { a: "line1\nline2", b: "z" },
  ]);
});

test("keeps a quote that appears in the middle of an unquoted field", () => {
  const objResult = parseCsv('a\n5" pipe');

  assert.deepEqual(objResult.arrRows, [{ a: '5" pipe' }]);
});

test("a quoted empty string is an empty cell", () => {
  const objResult = parseCsv('a,b\n"",x');

  assert.deepEqual(objResult.arrRows, [{ a: "", b: "x" }]);
});

test("handles LF, CRLF and CR line endings the same way", () => {
  const objExpected = parseCsv("a,b\n1,2\n3,4");

  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n3,4"), objExpected);
  assert.deepEqual(parseCsv("a,b\r1,2\r3,4"), objExpected);
  assert.equal(objExpected.arrRows.length, 2);
});

test("a trailing newline does not add a row", () => {
  assert.deepEqual(parseCsv("a\n1\n"), parseCsv("a\n1"));
});

test("strips a leading byte order mark", () => {
  const objResult = parseCsv("\uFEFFname,score\nAda,10");

  assert.equal(objResult.arrColumns[0].strField, "name");
});

test("skips blank lines", () => {
  const objResult = parseCsv("a,b\n1,2\n\n   \n3,4\n");

  assert.deepEqual(objResult.arrRows, [
    { a: 1, b: 2 },
    { a: 3, b: 4 },
  ]);
  assert.deepEqual(objResult.arrErrors, []);
});

test("empty or whitespace-only input gives an empty result with no errors", () => {
  for (const strCsv of ["", "\n\n", "  \n"]) {
    assert.deepEqual(parseCsv(strCsv), {
      arrColumns: [],
      arrRows: [],
      arrErrors: [],
    });
  }
});

test("supports other delimiters", () => {
  const objExpected = [{ a: "x", b: 1 }];

  assert.deepEqual(
    parseCsv("a;b\nx;1", { strDelimiter: ";" }).arrRows,
    objExpected,
  );
  assert.deepEqual(
    parseCsv("a\tb\nx\t1", { strDelimiter: "\t" }).arrRows,
    objExpected,
  );
});

test("a comma inside a field is literal when the delimiter is not a comma", () => {
  const objResult = parseCsv("a;b\nx,y;1", { strDelimiter: ";" });

  assert.deepEqual(objResult.arrRows, [{ a: "x,y", b: 1 }]);
});

test("boolHasHeader false generates column names and keeps every row", () => {
  const objResult = parseCsv("a,1\nb,2", { boolHasHeader: false });

  assert.deepEqual(objResult.arrColumns, [
    { strField: "column1", strType: COLUMN_TYPES.CATEGORY },
    { strField: "column2", strType: COLUMN_TYPES.NUMBER },
  ]);
  assert.deepEqual(objResult.arrRows, [
    { column1: "a", column2: 1 },
    { column1: "b", column2: 2 },
  ]);
});

test("undefined or null options fall back to the defaults", () => {
  const objExpected = parseCsv("a,b\n1,2");
  const arrOptionCases = [
    undefined,
    null,
    {},
    { strDelimiter: undefined },
    { strDelimiter: null },
    { boolHasHeader: undefined },
    { boolHasHeader: null },
    { boolInferTypes: undefined },
    { boolInferTypes: null },
  ];

  for (const objOptions of arrOptionCases) {
    assert.deepEqual(
      parseCsv("a,b\n1,2", objOptions),
      objExpected,
      JSON.stringify(objOptions),
    );
  }
});

test("rejects an invalid delimiter without throwing", () => {
  const arrDelimiters = [5, "", "ab", '"', "\n", "\r", {}];

  for (const strDelimiter of arrDelimiters) {
    assertFailure(parseCsv("a,b\n1,2", { strDelimiter }), /strDelimiter/);
  }
});

test("reports ragged rows with their row numbers", () => {
  const objResult = parseCsv("a,b\n1,2\n3\n4,5,6");

  assertFailure(objResult);
  assert.deepEqual(objResult.arrErrors, [
    "row 3: expected 2 fields, found 1",
    "row 4: expected 2 fields, found 3",
  ]);
});

test("reports a duplicate header", () => {
  const objResult = parseCsv("a,a\n1,2");

  assertFailure(objResult);
  assert.deepEqual(objResult.arrErrors, ['row 1: duplicate column name "a"']);
});

test("reports a blank header", () => {
  const objResult = parseCsv("a,,c\n1,2,3");

  assertFailure(objResult);
  assert.deepEqual(objResult.arrErrors, ["row 1: column 2 has a blank name"]);
});

test("reports an unterminated quoted field", () => {
  const objResult = parseCsv('a,b\n"1,2');

  assertFailure(objResult);
  assert.deepEqual(objResult.arrErrors, ["unterminated quoted field"]);
});

test("collects every error instead of stopping at the first", () => {
  const objResult = parseCsv("a,a\n1\n2,3,4");

  assert.deepEqual(objResult.arrErrors, [
    'row 1: duplicate column name "a"',
    "row 2: expected 2 fields, found 1",
    "row 3: expected 2 fields, found 3",
  ]);
});

test("rejects non-string input without throwing", () => {
  for (const anyInput of [undefined, null, 42, {}, [], true]) {
    assertFailure(parseCsv(anyInput), /string/);
  }
});

test("row numbers count blank lines so they match the file", () => {
  const objResult = parseCsv("a,b\n1,2\n\n3");

  assert.deepEqual(objResult.arrErrors, ["row 4: expected 2 fields, found 1"]);
});

test("row numbers account for leading blank lines before the header", () => {
  const objResult = parseCsv("\n\na,a\n1,2");

  assert.deepEqual(objResult.arrErrors, ['row 3: duplicate column name "a"']);
});

test("row numbers start at 1 when there is no header", () => {
  const objResult = parseCsv("1,2\n3", { boolHasHeader: false });

  assert.deepEqual(objResult.arrErrors, ["row 2: expected 2 fields, found 1"]);
});

test("a quoted field spanning lines counts as one row", () => {
  const objResult = parseCsv('a,b\n"x\ny",1\n2');

  assert.deepEqual(objResult.arrErrors, ["row 3: expected 2 fields, found 1"]);
});

test("never throws on odd input or options", () => {
  const arrCsvCases = ["", "\n", ",", ",,\n,,", '"', '""', "\r", "a,b\n1,2"];
  const arrOptionCases = [
    undefined,
    null,
    {},
    { strDelimiter: undefined },
    { strDelimiter: null },
    { strDelimiter: 5 },
    { strDelimiter: "" },
    { strDelimiter: "ab" },
    { boolHasHeader: false },
    { boolInferTypes: false },
  ];

  for (const strCsv of arrCsvCases) {
    for (const objOptions of arrOptionCases) {
      assert.doesNotThrow(
        () => parseCsv(strCsv, objOptions),
        `${JSON.stringify(strCsv)} with ${JSON.stringify(objOptions)}`,
      );
    }
  }
});
