/* @flow */

import type { SegmentLookup, SegmentR } from "@capnp-js/memory";
import type { ArenaR } from "@capnp-js/reader-core";

import { Base, Limited } from "@capnp-js/base-arena";
import { root } from "@capnp-js/memory";
import { StructValue } from "@capnp-js/reader-core";

type uint = number;

//TODO: Document requirement that an arena's root pointer is always in bounds
export default class Reader extends Base<SegmentR> implements SegmentLookup<SegmentR>, ArenaR {
  static limited(segments: $ReadOnlyArray<SegmentR>, maxBytes: uint, maxLevel: uint): this {
    return new this(segments, new Limited(maxBytes, maxLevel));
  }

  getRoot(): null | StructValue {
    return StructValue.get(0, this, root(this));
  }
}
