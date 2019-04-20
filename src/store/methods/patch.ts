import { Request, Response, HeadersInit } from "@opennetwork/http-representation";
import { RDFStoreOptions } from "../options";
import isType, { isOneOfType } from "../is-type";
import hash from "../hash";
import { serialize, sym, sparqlUpdateParser, graph, parse, SPARQLToQuery, IndexedFormula, UpdateClauses } from "rdflib";
import { RDF_MIME_TYPES } from "../mime-types";

function queryForFirstResult(store: IndexedFormula, sparql: string): Promise<UpdateClauses> {
  return new Promise((resolve, reject) => {
    const query = SPARQLToQuery(sparql, false, store);
    store.query(query, resolve, undefined, () => reject(new Error("No results.")));
  });
}

async function parseN3(targetURI: string, patchText: string) {
  const patchGraph = graph();
  const patchURI = targetURI + `#patch-${await hash(patchText)}`;
  await new Promise(
    (resolve, reject) => parse(
      patchText,
      patchGraph,
      patchURI,
      "text/n3",
      (error) => error ? reject(error) : resolve()
    )
  );
  const firstResult = await queryForFirstResult(patchGraph, `PREFIX solid: <http://www.w3.org/ns/solid/terms#>
  SELECT ?insert ?delete ?where WHERE {
    ?patch solid:patches <${targetURI}>.
    OPTIONAL { ?patch solid:inserts ?insert. }
    OPTIONAL { ?patch solid:deletes ?delete. }
    OPTIONAL { ?patch solid:where   ?where.  }
  }`);

  // Return the insertions and deletions as an rdflib patch document
  const { "?insert": insert, "?delete": deleted, "?where": where } = firstResult;
  if (!insert && !deleted) {
    throw new Error("Patch should at least contain inserts or deletes.");
  }
  return {
    insert,
    delete: deleted,
    where
  };
}

async function handleMethod(request: Request, options: RDFStoreOptions, fetch: (request: Request) => Promise<Response>): Promise<Response> {

  const currentResource = await fetch(
    new Request(
      request.url,
      {
        method: "GET",
        headers: {
          "Accept": Array.from(RDF_MIME_TYPES.values()).join(", ")
        }
      }
    )
  );

  let targetContentType = "text/turtle";

  if (currentResource.status !== 404) {
    targetContentType = (currentResource.headers.get("Content-Type") || targetContentType).split(";")[0].trim();
  }

  if (!isOneOfType(request.headers, ["application/sparql-update", "text/n3"])) {
    return new Response(
      `Unsupported patch content type: ${request.headers.get("Content-Type")}`,
      {
        status: 415
      }
    );
  }

  const patchText = await request.text();

  let patchObject: UpdateClauses;

  try {
    if (isType(request.headers, "application/sparql-update")) {
      patchObject = sparqlUpdateParser(patchText, graph(), request.url);
    } else { // } if (isType(request.headers, "text/n3")) {
      patchObject = await parseN3(request.url, patchText);
    }
  } catch (e) {
    return new Response(
      `Patch document syntax error: ${e}`,
      {
        status: 400
      }
    );
  }

  const currentResourceText = currentResource.status === 404 ? "" : await currentResource.text();

  const resourceGraph = graph();

  await new Promise(
    (resolve, reject) => parse(
      currentResourceText,
      resourceGraph,
      request.url,
      targetContentType,
      (error) => error ? reject(error) : resolve()
    )
  );

  await new Promise(
    (resolve, reject) => resourceGraph.applyPatch(
      patchObject,
      sym(request.url),
      (error) => error ? reject(error) : resolve()
    )
  );

  const newBody = await new Promise(
    (resolve, reject) => serialize(
      sym(request.url),
      resourceGraph,
      request.url,
      targetContentType,
      (error, value) => error ? reject(error) : resolve(value)
    )
  );

  const writeResponse = await fetch(
    new Request(
      request.url,
      {
        method: "PUT",
        headers: {
          "Content-Type": targetContentType
        },
        body: newBody
      }
    )
  );

  if (!writeResponse.ok) {
    // May be unauthorised etc
    return writeResponse;
  }

  const response = new Response(
    "Patch applied successfully.\n",
    {
      // PUT may respond with something other than 200, we want only 201 or 200
      status: writeResponse.status === 201 ? 201 : 200,
      headers: writeResponse.headers
    }
  );

  response.headers.set("Content-Type", "text/plain");

  return response;
}

export default handleMethod;
