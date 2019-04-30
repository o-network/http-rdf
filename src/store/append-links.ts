import { Request, Headers } from "@opennetwork/http-representation";
import { appendLinks, formatLink } from "./util";

function getServiceUrl(request: Request): string {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname.substr(0, url.pathname.lastIndexOf("/"))}/`;
  }
  url.pathname += ".well-known/solid";
  return url.toString();
}

export default function append(request: Request, headers: Headers) {
  const links: string[] = [];
  links.push(formatLink(getServiceUrl(request), "service"));
  headers.set("Accept-Patch", "application/sparql-update");
  appendLinks(headers, links);
  if (request.method !== "DELETE") {
    headers.set("MS-Author-Via", "SPARQL");
  }
}
