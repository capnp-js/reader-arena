/* @flow */

import { Unlimited } from "@capnp-js/base-arena";

import Reader from "./Reader";

const segments = [{ id: 0, raw: new Uint8Array(8), end: 8}];
const empty = new Reader(segments, new Unlimited());

export default empty;
