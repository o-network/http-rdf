import { Headers } from "@opennetwork/http-representation";
import { preferredMediaTypes } from "./media-type";

export function isOneOfAccepted(headers: Headers | string, types: Iterable<string> | ArrayLike<string>): boolean {
  return preferredMediaTypes(typeof headers === "string" ? headers : headers.get("accept"), types).length > 0;
}

export default function isAccepted(headers: Headers | string, contentType: string): boolean {
  return isOneOfAccepted(headers, [contentType]);
}
