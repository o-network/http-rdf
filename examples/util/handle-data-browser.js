import { Request, Response, ResponseBuilder, Headers } from "@opennetwork/http-representation";
import { origin } from "../origin";
import { preferredMediaTypes } from "../../dist/store/media-type";
import getPath from "@opennetwork/http-store/dist/fs-store/get-path";
import fs from "fs";
import { RDF_MIME_TYPES } from "../../dist/store/mime-types";
import Cheerio from "cheerio";

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


    const builder = new ResponseBuilder();

    builder.withHeaders({
      "Content-Type": "text/html; charset=utf-8"
    });

    if (new URL(request.url).pathname !== dataBrowserPath) {
      builder.withHeaders({
        "Content-Location": dataBrowserUrl
      });
    }

    if (request.method.toUpperCase() !== "GET") {
      builder.with(new Response(undefined, { status: 200 }));
      return builder.build();
    }

    const givenHeadersLD = new Headers(request.headers);
    givenHeadersLD.set("Accept", "application/ld+json");

    const givenHeadersTurtle = new Headers(request.headers);
    givenHeadersTurtle.set("Accept", "text/turtle");

    const givenHeaderN3 = new Headers(request.headers);
    givenHeaderN3.set("Accept", "text/n3");

    const [html, resourceLD, resourceTurtle, resourceN3] = await Promise.all([
      new Promise(
        (resolve, reject) => {
          fs.readFile(
            path,
            {
              encoding: "utf-8"
            },
            (error, data) => error ? reject(error) : resolve(data)
          )
        }
      ),
      fetchNext(
        new Request(
          request.url,
          {
            method: "GET",
            headers: givenHeadersLD
          }
        )
      )
        .then(response => response.text()),
      fetchNext(
        new Request(
          request.url,
          {
            method: "GET",
            headers: givenHeadersTurtle
          }
        )
      )
        .then(response => response.text()),
      fetchNext(
        new Request(
          request.url,
          {
            method: "GET",
            headers: givenHeaderN3
          }
        )
      )
        .then(response => response.text())
    ]);

    // Inject data here so that HTML has full content
    const $ = Cheerio.load(html);
    $("body").append(`<script type="application/ld+json">${resourceLD}</script>`);
    $("body").append(`<script type="text/turtle">${resourceTurtle}</script>`);
    $("body").append(`<script type="text/n3">${resourceN3}</script>`);
    const htmlWithLD = $.html();

    const headers = (await builder.build()).headers;

    builder.with(new Response(
      htmlWithLD,
      {
        status: 200,
        headers
      }
    ));

    return builder.build();
  };
}
