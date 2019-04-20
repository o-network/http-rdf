import { asBuffer, Request, Response, Headers, RequestInit } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";
import { getFileMetadata, appendFileMetadata } from "../util";
import handlePatch from "./patch";
import isType from "../is-type";
import UUID from "pure-uuid";
import { isValidRDF } from "../is-valid-rdf";

function readStringAsUint8Array(value: string): Uint8Array {
  const buffer = new ArrayBuffer(value.length * 2);
  const view = new Uint16Array(buffer);
  for (let index = 0; index < value.length; index += 1) {
    view[index] = value.charCodeAt(index);
  }
  return new Uint8Array(buffer);
}

/*
For containers we want to wrap it in a form-data request as we will create a new container URL and then
add our content to the metadata file
 */
async function handleContainerPOST(request: Request, options: RDFStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  if (!options.getContentLocation) {
    return new Response(
      undefined,
      {
        status: 501, // Not implemented
        headers: {
          Warning: "199 - Creating a new container is not currently implemented"
        }
      }
    );
  }

  const contentLocation = await options.getContentLocation(request);
  const url = new URL(contentLocation);

  // We're wanting to create this file as a container
  const metaSuffix = options.metaSuffix || ".meta";

  const contentType = request.headers.get("Content-Type");
  const body = await asBuffer(request);
  const boundary = new UUID(5, "ns:URL", url.origin).format("std");

  // https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
  // boundary := 0*69<bchars> bcharsnospace
  // # Have removed all the characters we won't ever use, but UUID is valid according to the spec
  // bcharsnospace := DIGIT / ALPHA / "-"
  const parts: Uint8Array[] = [];
  // New line before first boundary, We can add preamble text here if needed
  parts.push(readStringAsUint8Array(`\n--${boundary}\n`));
  // Name our new file, should be within our container as metaSuffix
  // use any name for the formData name, filename is all we care about
  parts.push(readStringAsUint8Array(`Content-Disposition: form-data; name="files[]"; filename="${metaSuffix}"`));
  if (contentType) {
    parts.push(readStringAsUint8Array(`Content-Type: ${contentType}`));
  }
  // New line in between headers and body
  parts.push(readStringAsUint8Array("\n"));
  parts.push(body);
  // New line before end boundary
  // New line also after, for epilogue, where we can add text if needed
  parts.push(readStringAsUint8Array(`\n--${boundary}\n`));

  const resultingBody = new Uint8Array(parts.reduce((all, part) => all.concat(part), []));

  const headers = new Headers(request.headers);

  headers.set("Content-Type", `multipart/form-data; boundary="${boundary}"`);
  headers.set("Content-Length", resultingBody.length.toString());

  // Throw back to handler as we can now process it correctly
  return handleMethod(
    new Request(
      url.toString(),
      {
        method: "POST",
        headers,
        body: resultingBody
      }
    ),
    options,
    fetch
  );
}

async function handleMethod(request: Request, options: RDFStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {
  const requestInit: RequestInit = {
    method: request.method,
    headers: request.headers,
    body: request
  };

  if (request.method === "POST" && (isType(request.headers, "application/sparql") || isType(request.headers, "application/sparql-update"))) {
    // Fetch as patch instead
    return handlePatch(
      new Request(
        request.url,
        {
          ...requestInit,
          method: "PATCH"
        } as RequestInit
      ),
      options,
      fetch
    );
  }

  const url = new URL(request.url);

  // Do mapping for containers here
  const fileMetadata = getFileMetadata(request.headers);

  if (request.method === "POST" && fileMetadata.isBasicContainer && !isType(request.headers, "multipart/form-data")) {
    return handleContainerPOST(request, options, fetch);
  }

  if (request.method === "PUT" && url.pathname.endsWith(".acl")) {
    // Force text if ACL file
    requestInit.body = await request.text();
    // If the contents isn't valid then we want to
    if (!(await isValidRDF(requestInit.body, request.url, request.headers.get("Content-Type")))) {
      return new Response(
        "RDF file contains invalid syntax",
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain"
          }
        }
      );
    }
  }

  const newRequest = new Request(
    url.toString(),
    requestInit
  );

  // Fetch shouldn't loop back round to here, we intend for this to be fulfilled by an fs-store for example
  const response = await fetch(newRequest);

  if (request.method === "POST" && !request.headers.get("multipart/form-data")) {
    // For now we will only add back for a post that isn't multipart
    appendFileMetadata(response.headers, fileMetadata);
  }

  return response;
}

export default handleMethod;
