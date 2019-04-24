import { Request, Response } from "@opennetwork/http-representation";
import { origin } from "../origin";
import { preferredMediaTypes } from "../../dist/store/media-type";
import getPath from "@opennetwork/http-store/dist/fs-store/get-path";
import fs from "fs";
import { RDF_MIME_TYPES } from "../../dist/store/mime-types";

export default (fsStoreOptions) => {
  return async function handleDataBrowser(request, { fetchNext }) {
    if (!["GET", "HEAD"].includes(request.method.toUpperCase())) {
      // Not our problem
      return undefined;
    }

    const requestedType = preferredMediaTypes(request.headers.get("Accept"))[0];

    // Browsers will ask for text/html to begin with
    if (!requestedType || requestedType === "*/*") {
      return undefined;
    }

    const isHTML = !!preferredMediaTypes(requestedType, ["text/html"])[0];

    if (!isHTML) {
      // They don't want a text page
      return undefined;
    }

    const currentResource = await fetchNext(
      new Request(
        request.url,
        {
          method: "HEAD",
          headers: request.headers
        }
      )
    );

    if (!currentResource.ok) {
      return undefined;
    }

    const contentType = (currentResource.headers.get("Content-Type") || "").split(";")[0].trim();

    // If we can't handle it as RDF, then don't even try
    if (!preferredMediaTypes(contentType || "*/*", RDF_MIME_TYPES)[0]) {
      return undefined;
    }

    if (preferredMediaTypes(contentType, ["text/html"])[0]) {
      // The content is already html, so don't try and do anything with it
      return undefined;
    }

    const dataBrowserPath = "/static/databrowser.html";
    const dataBrowserUrl = new URL(dataBrowserPath, origin).toString();
    const path = await getPath(dataBrowserUrl, fsStoreOptions);
    const headers = {
      "Content-Type": "text/html; charset=utf-8"
    };
    if (new URL(request.url).pathname !== dataBrowserPath) {
      headers["Content-Location"] = dataBrowserUrl;
    }

    let body;

    if (request.method.toUpperCase() === "GET") {
      body = fs.createReadStream(
        path,
        {
          encoding: "utf-8"
        }
      );
    }

    return new Response(
      body,
      {
        status: 200,
        headers
      }
    );
  };
}
