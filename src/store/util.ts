import { Headers } from "@opennetwork/http-representation";
import li from "li";

export type FileMetadata = {
  isResource?: boolean;
  isSourceResource?: boolean;
  isContainer?: boolean;
  isBasicContainer?: boolean;
  isDirectContainer?: boolean;
};

export function appendLinks(headers: Headers, values: string[]): void {
  // getAll will return an array that will contain all the versions of this header
  // We"re going to join them all together to be safe
  //
  // Doing this means we can also just call this function with an empty array for
  // values which will join all our current link headers together
  const currentLinks = headers.getAll("Link");
  const allLinks = currentLinks
    .concat(
      // Join up all the new values
      values
        .join(", ")
    )
    // Join new values with current values
    .join(", ");
  // Using set rather than append will overwrite whatever was there before
  // so we are left with a single header
  headers.set("Link", allLinks);
}

export function getFileMetadata(headers: Headers): FileMetadata {
  return headers.get("Link")
    .split(/\s*,\s*/)
    .map(link => li.parse(link))
    .reduce(
      (fileMetadata: FileMetadata, parsedLinks) => {
        Object.keys(parsedLinks)
          .forEach(rel => {
            if (rel === "type") {
              if (parsedLinks[rel] === "http://www.w3.org/ns/ldp#Resource") {
                fileMetadata.isResource = true;
              } else if (parsedLinks[rel] === "http://www.w3.org/ns/ldp#RDFSource") {
                fileMetadata.isSourceResource = true;
              } else if (parsedLinks[rel] === "http://www.w3.org/ns/ldp#Container") {
                fileMetadata.isContainer = true;
              } else if (parsedLinks[rel] === "http://www.w3.org/ns/ldp#BasicContainer") {
                fileMetadata.isBasicContainer = true;
              } else if (parsedLinks[rel] === "http://www.w3.org/ns/ldp#DirectContainer") {
                fileMetadata.isDirectContainer = true;
              }
            }
          });
        return fileMetadata;
      },
      {}
    );
}

export function formatLink(value: string, rel: string) {
  return `<${value}>; rel="${rel}"`;
}

export function appendFileMetadata(headers: Headers, metadata: FileMetadata): void {
  const links: string[] = [];
  if (metadata.isResource) {
    links.push(formatLink("http://www.w3.org/ns/ldp#Resource", "type"));
  }
  if (metadata.isSourceResource) {
    links.push(formatLink("http://www.w3.org/ns/ldp#RDFSource", "type"));
  }
  if (metadata.isContainer) {
    links.push(formatLink("http://www.w3.org/ns/ldp#Container", "type"));
  }
  if (metadata.isBasicContainer) {
    links.push(formatLink("http://www.w3.org/ns/ldp#BasicContainer", "type"));
  }
  if (metadata.isDirectContainer) {
    links.push(formatLink("http://www.w3.org/ns/ldp#DirectContainer", "type"));
  }
  appendLinks(headers, links);
}
