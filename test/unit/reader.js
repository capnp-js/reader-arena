/* @flow */

import test from "ava";
import { Unlimited } from "@capnp-js/base-arena";
import { Builder } from "@capnp-js/builder-arena";
import { PointerLevelError, ReadLimitError } from "@capnp-js/internal-error";
import { root } from "@capnp-js/memory";
import { int32 } from "@capnp-js/write-data";

import Reader from "../../src/Reader";

//TODO: Generate some data to unserialize and compress it with the capnpc compiler and node's base64 buffer stuff.
//      Check that it round trips correctly.
test("`getRoot`", t => {
  t.plan(1);

  const segment = {
    id: 0,
    raw: new Uint8Array(24),
    end: 24,
  };

  const arena = Reader.limited([segment], 1024, 64);

  const root = arena.getRoot();

  t.is(root, null);
});

test("limited `specificStructLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x00,
    hi: 0x00000001,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.specificStructLayout(p, {data: 8, pointers: 0}));
  t.throws(() => {
    reader.specificStructLayout(p, {data: 8, pointers: 0});
  }, ReadLimitError);
});

test("limited `genericStructLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x00,
    hi: 0x00000001,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.genericStructLayout(p));
  t.throws(() => {
    reader.genericStructLayout(p);
  }, ReadLimitError);
});

test("limited `boolListLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x01,
    hi: (1<<3) | 0x01,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.boolListLayout(p));
  t.throws(() => {
    reader.boolListLayout(p);
  }, ReadLimitError);
});

test("limited `blobLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x01,
    hi: (1<<3) | 0x02,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.blobLayout(p));
  t.throws(() => {
    reader.blobLayout(p);
    //TODO: Lint all tests
  }, ReadLimitError);
});

test("limited `specificNonboolListLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x01,
    hi: (1<<3) | 0x05,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.specificNonboolListLayout(p, {flag: 0x05, bytes: {data: 1, pointers: 0}}));
  t.throws(() => {
    reader.specificNonboolListLayout(p, {flag: 0x05, bytes: {data: 1, pointers: 0}})
  }, ReadLimitError);
});

test("limited `genericNonboolListLayout`", t => {
  const segment = {
    id: 0,
    raw: new Uint8Array(16),
    end: 16,
  };
  const reader = Reader.limited([segment], 8, 64);
  const p = {
    typeBits: 0x01,
    hi: (1<<3) | 0x02,
    object: {
      segment,
      position: 0,
    },
  };
  t.notThrows(() => reader.genericNonboolListLayout(p));
  t.throws(() => {
    reader.genericNonboolListLayout(p)
  }, ReadLimitError);
});

test("circular reference `structCopy`", t => {
  t.plan(3);

  const builder = Builder.fresh(128, new Unlimited());
  const alloc = builder.allocate(8);
  const raw = alloc.segment.raw;

  int32(0x00, raw, 0);
  int32((0x01<<16) | 0x00, raw, 4);

  const reader = Reader.limited(builder.segments, 2048, 64);
  const layout = reader.genericStructLayout(reader.pointer(root(reader)));
  t.deepEqual(layout, {
    tag: "struct",
    bytes: {data: 0, pointers: 8},
    dataSection: 8,
    pointersSection: 8,
    end: 16,
  });

  int32((-2<<2) | 0x00, raw, 8);
  int32((0x01<<16) | 0x00, raw, 12);
  const next = {
    segment: reader.segment(0),
    position: 8,
  };
  t.deepEqual(reader.genericStructLayout(reader.pointer(next)), {
    tag: "struct",
    bytes: {data: 0, pointers: 8},
    dataSection: 0,
    pointersSection: 0,
    end: 8,
  });

  const targetArena = Builder.fresh(128, new Unlimited());
  const target = targetArena.allocate(8);
  t.throws(() => {
    reader.structCopy(layout, alloc.segment, 0, targetArena, target)
  }, PointerLevelError);
});

test("circular reference `nonboolListCopy` 0x06", t => {
  t.plan(3);

  const builder = Builder.fresh(128, new Unlimited());
  const alloc = builder.allocate(8);
  const raw = alloc.segment.raw;

  int32(0x01, raw, 0);
  int32((1<<3) | 0x06, raw, 4);

  const reader = Reader.limited(builder.segments, 2048, 64);
  const layout = reader.genericNonboolListLayout(reader.pointer(root(reader)));
  t.deepEqual(layout, {
    tag: "non-bool list",
    encoding: {
      flag: 0x06,
      bytes: {data: 0, pointers: 8},
    },
    begin: 8,
    length: 1,
  });

  int32((-2<<2) | 0x01, raw, 8);
  int32((1<<3) | 0x06, raw, 12);
  const next = {
    segment: reader.segment(0),
    position: 8,
  };
  t.deepEqual(reader.genericNonboolListLayout(reader.pointer(next)), {
    tag: "non-bool list",
    encoding: {
      flag: 0x06,
      bytes: {data: 0, pointers: 8},
    },
    begin: 0,
    length: 1,
  });

  const targetArena = Builder.fresh(128, new Unlimited());
  const target = targetArena.allocate(8);
  t.throws(() => {
    reader.nonboolListCopy(layout, alloc.segment, 0, targetArena, target);
  }, PointerLevelError);
});

test("circular reference `nonboolListCopy` 0x07", t => {
  t.plan(3);

  const builder = Builder.fresh(128, new Unlimited());
  const alloc = builder.allocate(16);
  const raw = alloc.segment.raw;

  int32(0x01, raw, 0);
  int32((1<<3) | 0x07, raw, 4);
  int32((1<<2) | 0x00, raw, 8);
  int32((0x01<<16) | 0x00, raw, 12);

  const reader = Reader.limited(builder.segments, 2048, 64);
  const layout = reader.genericNonboolListLayout(reader.pointer(root(reader)));
  t.deepEqual(layout, {
    tag: "non-bool list",
    encoding: {
      flag: 0x07,
      bytes: {data: 0, pointers: 8},
    },
    begin: 16,
    length: 1,
  });

  int32((-2<<2) | 0x01, raw, 16);
  int32((1<<3) | 0x07, raw, 20);
  const next = {
    segment: reader.segment(0),
    position: 16,
  };
  t.deepEqual(reader.genericNonboolListLayout(reader.pointer(next)), {
    tag: "non-bool list",
    encoding: {
      flag: 0x07,
      bytes: {data: 0, pointers: 8},
    },
    begin: 16,
    length: 1,
  });

  const targetArena = Builder.fresh(128, new Unlimited());
  const target = targetArena.allocate(8);
  t.throws(() => {
    reader.nonboolListCopy(layout, alloc.segment, 0, targetArena, target);
  }, PointerLevelError);
});
