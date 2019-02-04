/* @flow */

import { Unlimited } from "@capnp-js/base-arena";
import { startDecodeSync as startBytes } from "@capnp-js/trans-base64";
import { transDecodeSync as unpacking } from "@capnp-js/trans-packing";
import { finishDecodeSync as finish } from "@capnp-js/trans-stream";

import Reader from "./Reader";

const start = startBytes(new Uint8Array(2046));
const unpack = unpacking(new Uint8Array(2048));

export default function deserializeUnsafe(base64: string): Reader {
  const finished = finish(unpack(start(base64)));
  if (finished instanceof Error) {
    throw finished;
  }

  const segments = finished.map((raw, i) => {
    return {
      id: i,
      raw,
      end: raw.length,
    };
  });

  return new Reader(segments, new Unlimited());
}
