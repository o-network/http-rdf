import { Request, Headers } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "./options";
import { appendLinks, formatLink } from "./util";

function getServiceUrl(request: Request): string {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname.substr(0, url.pathname.lastIndexOf("/"))}/`;
  }
  url.pathname += ".well-known/solid";
  return url.toString();
}

function getLiveUrl(request: Request, options: RDFStoreOptions): string {
  const url = new URL(request.url);
  if (options.liveOrigin) {
    const newOrigin = new URL(options.liveOrigin);
    url.host = newOrigin.host;
    url.protocol = newOrigin.protocol;
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else {
    // If not http, then use wss for everything else,
    url.protocol = "wss:";
  }
  return url.toString();
}

export default function append(request: Request, headers: Headers, options: RDFStoreOptions) {
  const links: string[] = [];
  links.push(formatLink(getServiceUrl(request), "service"));
  headers.set("Accept-Patch", "application/sparql-update");
  appendLinks(headers, links);
  if (request.method !== "DELETE") {
    headers.set("MS-Author-Via", "SPARQL");
  }
  if (options.live) {
    headers.set("Updates-Via", getLiveUrl(request, options));
  }
}
