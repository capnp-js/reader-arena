/* @flow */

import { Unlimited } from "@capnp-js/base-arena";
import { create } from "@capnp-js/bytes";

import Reader from "./Reader";

const segments = [{ id: 0, raw: create(8), end: 8}];
const empty = new Reader(segments, new Unlimited());

export default empty;
