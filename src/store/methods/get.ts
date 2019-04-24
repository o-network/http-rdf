import { Request, Response } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";
import { RDF_MIME_TYPES } from "../mime-types";
import { graph, parse, serialize } from "rdflib";
import { preferredMediaTypes } from "../media-type";
import isAccepted from "../is-accepted";

async function handleMethod(request: Request, options: RDFStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {

  const possibleRDFType = preferredMediaTypes(request.headers.get("Accept"), RDF_MIME_TYPES)[0];

  // Data browser should be accepted _after_ the RDF type
  if (!possibleRDFType) {
    // We can't handle this
    return undefined;
  }

  const currentResource = await fetch(
    new Request(
      request.url,
      {
        method: "GET",
        headers: request.headers
      }
    )
  );

  if (!currentResource.ok) {
    return currentResource;
  }

  if (!possibleRDFType) {
    return new Response(
      undefined,
      {
        status: 406
      }
    );
  }

  const contentType = (currentResource.headers.get("Content-Type") || "").split(";")[0].trim();

  // If its already accepted, we don't need to translate it
  if (!isAccepted(request.headers, contentType)) {
    return currentResource;
  }

  // We already know they accept an RDF type from RDF store code
  const currentResourceText = await currentResource.text();

  const resourceGraph = graph();

  await new Promise(
    (resolve, reject) => parse(
      currentResourceText,
      resourceGraph,
      request.url,
      (currentResource.headers.get("Content-Type") || "text/turtle").split(";")[0].trim(),
      (error) => error ? reject(error) : resolve()
    )
  );

  const body = await new Promise(
    (resolve, reject) => serialize(
      undefined,
      resourceGraph,
      request.url,
      possibleRDFType,
      (error, value) => error ? reject(error) : resolve(value)
    )
  );

  const response = new Response(
    body,
    {
      status: 200,
      headers: currentResource.headers
    }
  );
  response.headers.set("Content-Type", possibleRDFType);
  return response;
}

export default handleMethod;
