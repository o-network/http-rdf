import { Headers } from "@opennetwork/http-representation";
import { preferredMediaTypes } from "./media-type";

export function isOneOfAccepted(headers: Headers, types: Iterable<string> | ArrayLike<string>): boolean {
  return preferredMediaTypes(headers.get("accept"), types).length > 0;
}

export default function isAccepted(headers: Headers, contentType: string): boolean {
  return isOneOfAccepted(headers, [contentType]);
}
