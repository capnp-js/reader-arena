/* @flow */

import * as assert from "assert";
import { describe, it } from "mocha";
import { Unlimited } from "@capnp-js/base-arena";
import { Builder } from "@capnp-js/builder-arena";
import { PointerLevelError, ReadLimitError } from "@capnp-js/internal-error";
import { root } from "@capnp-js/memory";
import { int32 } from "@capnp-js/write-data";

import Reader from "../../src/Reader";

//TODO: Generate some data to unserialize and compress it with the capnpc compiler and node's base64 buffer stuff.
//      Check that it round trips correctly.
describe("Reader", function () {
  describe(".getRoot", function () {
    const segment = { id: 0, raw: new Uint8Array(24), end: 24 };
    const arena = Reader.limited([segment], 1024, 64);
    const root = arena.getRoot();
    it("returns null for uninitialized root pointers", function () {
      assert.equal(root, null);
    });
  });

  describe(".specificStructLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x00,
      hi: 0x00000001,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.specificStructLayout(p, {data: 8, pointers: 0}));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.specificStructLayout(p, {data: 8, pointers: 0});
      }, ReadLimitError);
    });
  });

  describe(".genericStructLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x00,
      hi: 0x00000001,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.genericStructLayout(p));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.genericStructLayout(p);
      }, ReadLimitError);
    });
  });

  describe(".boolListLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x01,
      hi: (1<<3) | 0x01,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.boolListLayout(p));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.boolListLayout(p);
      }, ReadLimitError);
    });
  });

  describe(".blobLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x01,
      hi: (1<<3) | 0x02,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.blobLayout(p));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.blobLayout(p);
        //TODO: Lint all tests
      }, ReadLimitError);
    });
  });

  describe(".specificNonboolListLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x01,
      hi: (1<<3) | 0x05,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.specificNonboolListLayout(p, {flag: 0x05, bytes: {data: 1, pointers: 0}}));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.specificNonboolListLayout(p, {flag: 0x05, bytes: {data: 1, pointers: 0}})
      }, ReadLimitError);
    });
  });

  describe(".genericNonboolListLayout", function () {
    const segment = { id: 0, raw: new Uint8Array(16), end: 16 };
    const reader = Reader.limited([segment], 8, 64);
    const p = {
      typeBits: 0x01,
      hi: (1<<3) | 0x02,
      object: {
        segment,
        position: 0,
      },
    };

    it("doesn't throw for byte reads below the arena's limit", function () {
      assert.doesNotThrow(() => reader.genericNonboolListLayout(p));
    });

    it("throws for byte reads beyond the arena's limit", function () {
      assert.throws(() => {
        reader.genericNonboolListLayout(p)
      }, ReadLimitError);
    });
  });

  describe(".structCopy", function () {
    it("errors out on circular references", function () {
      const builder = Builder.fresh(128, new Unlimited());
      const alloc = builder.allocate(8);
      const raw = alloc.segment.raw;

      int32(0x00, raw, 0);
      int32((0x01<<16) | 0x00, raw, 4);

      const reader = Reader.limited(builder.segments, 2048, 64);
      const layout = reader.genericStructLayout(reader.pointer(root(reader)));
      assert.deepEqual(layout, {
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
      assert.deepEqual(reader.genericStructLayout(reader.pointer(next)), {
        tag: "struct",
        bytes: {data: 0, pointers: 8},
        dataSection: 0,
        pointersSection: 0,
        end: 8,
      });

      const targetArena = Builder.fresh(128, new Unlimited());
      const target = targetArena.allocate(8);

      assert.throws(() => {
        reader.structCopy(layout, alloc.segment, 0, targetArena, target)
      }, PointerLevelError);
    });
  });

  describe(".nonboolListCopy", function () {
    it("errors out on circular 0x06 references", function () {
      const builder = Builder.fresh(128, new Unlimited());
      const alloc = builder.allocate(8);
      const raw = alloc.segment.raw;

      int32(0x01, raw, 0);
      int32((1<<3) | 0x06, raw, 4);

      const reader = Reader.limited(builder.segments, 2048, 64);
      const layout = reader.genericNonboolListLayout(reader.pointer(root(reader)));
      assert.deepEqual(layout, {
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
      assert.deepEqual(reader.genericNonboolListLayout(reader.pointer(next)), {
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
      assert.throws(() => {
        reader.nonboolListCopy(layout, alloc.segment, 0, targetArena, target);
      }, PointerLevelError);
    });

    it("errors out on circular 0x07 references", function () {
      const builder = Builder.fresh(128, new Unlimited());
      const alloc = builder.allocate(16);
      const raw = alloc.segment.raw;

      int32(0x01, raw, 0);
      int32((1<<3) | 0x07, raw, 4);
      int32((1<<2) | 0x00, raw, 8);
      int32((0x01<<16) | 0x00, raw, 12);

      const reader = Reader.limited(builder.segments, 2048, 64);
      const layout = reader.genericNonboolListLayout(reader.pointer(root(reader)));
      assert.deepEqual(layout, {
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
      assert.deepEqual(reader.genericNonboolListLayout(reader.pointer(next)), {
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
      assert.throws(() => {
        reader.nonboolListCopy(layout, alloc.segment, 0, targetArena, target);
      }, PointerLevelError);
    });
  });
});
