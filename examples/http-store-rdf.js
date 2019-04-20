import { FSStore } from "@opennetwork/http-store";
import { fromRequest, sendResponse } from "@opennetwork/http-representation-node";
import { Request, Response, ResponseBuilder } from "@opennetwork/http-representation";
import { getResponse, getAllowedHeaderValue } from "@opennetwork/web-access-control";
import http from "http";
import fs from "fs";
import rimraf from "rimraf";
import { mkdirp } from "fs-extra";
import getACLResponseBase from "./util/http-store-with-acl";
import getContentTypeResponse from "./util/content-type";
import ACLCheck from "@solid/acl-check";
import { RDFStore } from "../dist";
import { lookup, extension } from "mime-types";
import { basename, dirname, extname } from "path";
import fetchExternal from "node-fetch";
import Negotiator from "negotiator";

ACLCheck.configureLogger(() => {});

const getContentType = request => {
  if (request.method !== "HEAD" && request.method !== "GET") {
    return undefined; // No content
  }
  // Provided content type already
  if (request.headers.get("Content-Type")) {
    return request.headers.get("Content-Type");
  }
  return lookup(new URL(request.url).pathname)
};

const baseStore = new FSStore({
  fs,
  rootPath: './examples/store',
  statusCodes: http.STATUS_CODES,
  rimraf,
  mkdirp,
  getContentType,
  getContentLocation: async (request, getPath) => {
    const magicExtensionRegex = /\$\.[^.]+/i;

    const url = new URL(request.url);

    if (request.method === "PUT" && magicExtensionRegex.test(url.pathname)) {
      // The user has requested to use a magic extension directly
      return undefined;
    }

    const path = await getPath(request.url);

    async function stat(path) {
      return new Promise(
        resolve => fs.stat(
          path,
          (error, stat) => resolve(error ? undefined : stat)
        )
      );
    }

    const pathStat = await stat(path);

    if (pathStat && pathStat.isFile()) {
      // Is already correct and we can continue on
      return undefined;
    }

    const providedType = (request.headers.get("Content-Type") || "").split(";")[0].trim();
    const extensionType = lookup(url.pathname);

    if (request.method === "PUT" && extensionType && providedType && extensionType === providedType) {
      return undefined;
    }

    if (request.method === "PUT") {
      url.pathname += `$.${(extensionType || providedType) ? extension(extensionType || providedType) : "unknown"}`;
      return url.toString();
    }

    const isPathDirectory = pathStat && pathStat.isDirectory();

    const directory = isPathDirectory ? path : dirname(path);

    const directoryStat = isPathDirectory ? pathStat : await stat(directory);

    if (!(directoryStat && directoryStat.isDirectory())) {
      return undefined;
    }

    const baseName = basename(path, extname(path));

    if (isPathDirectory) {
      const indexPath = `${path.replace(/\/$/, "")}/index.html`;
      const indexStat = await stat(indexPath);
      if (!(indexStat && indexStat.isFile())) {
        return undefined;
      }
      url.pathname = `${url.pathname.replace(/\/$/, "")}/index.html`;
      return url.toString();
    }

    const files = await new Promise(
      (resolve, reject) => fs.readdir(
        directory,
        {
          encoding: "utf-8",
          withFileTypes: true
        },
        (error, files) => error ? reject(error) : resolve(files)
      )
    );

    const matching = files
      .filter(file => file.isFile())
      .filter(file => magicExtensionRegex.test(file.name))
      .filter(file => file.name.replace(magicExtensionRegex, "") === baseName)
      .map(file => file.name);

    if (matching.length === 0) {
      return undefined;
    }

    if (matching.length === 1) {
      // Magic extension found! No further content negotiation needed
      url.pathname += `$${extname(matching[0])}`;
      return url.toString();
    }

    const headers = {
      accept: request.headers.has("accept") ? request.headers.getAll("accept").join(",") : undefined
    };

    const matchingWithContentType = matching
      .map(file => [
        file,
        lookup(file)
      ]);

    const contentTypes = matchingWithContentType.map(values => values[1]);

    const negotiator = new Negotiator({ headers });
    const preferredContentType = negotiator.mediaTypes(contentTypes);

    console.log({ matchingWithContentType, contentTypes, preferredContentType });

    if (!preferredContentType) {
      // Use the first found, there is no preferred
      return matching[0];
    }

    const matched = matchingWithContentType
      .find(value => value[1] === preferredContentType);

    const toUse = matched ? matched[0] : matching[0];
    url.pathname += `$${extname(toUse)}`;
    return url.toString();
  }
});

const getACLResponse = getACLResponseBase(baseStore);

async function findCorrectExtension(request) {

}

async function fetch(request) {
  const builder = new ResponseBuilder({
    useSetForEntityHeaders: true
  });
  const [acl, base] = await Promise.all([
    getACLResponse(request),
    baseStore.fetch(request)
  ]);

  return builder
    .with(getContentTypeResponse(request))
    .with(acl)
    .with(base)
    .build();
}

const port = 8080;
const origin = `http://localhost:${port}/`;

const rdfStore = new RDFStore({
  authMethod: "oidc",
  serverUri: origin,
  metaSuffix: ".meta",
  aclSuffix: ".acl",
  findAvailablePOSTUrl: (...args) => baseStore.findAvailablePOSTUrl(...args),
  fetch,
  getDataBrowser: async () => {
    return new Response(fs.createReadStream("./examples/store/static/databrowser.html", { encoding: "utf-8" }), { status: 200, headers: { "Content-Type": "text/html" } });
  }
});

async function handleXSS(request, url) {
  if (!url.pathname.startsWith("/xss")) {
    return undefined;
  }
  if (!url.searchParams.has("uri")) {
    return new Response(undefined, {
      status: 400
    });
  }
  const uri = url.searchParams.get("uri");
  return fetchExternal(uri);
}

async function handleFile(request) {
  const url = new URL(request.url);

  const earlyXSSResponse = await handleXSS(request, url);

  if (earlyXSSResponse) {
    return earlyXSSResponse;
  }

  if (url.pathname.startsWith("/.well-known")) {
    url.pathname = url.pathname.replace("/.well-known", "/common/well-known");
    return handleFile(
      new Request(
        url.toString()
      )
    );
  }

  function routeResolvedFile(path, file, appendFileName = true) {
    const fullPath = appendFileName ? path + file.match(/[^/]+$/) : path
    const fullFile = require.resolve(file);
    return [
      fullPath,
      async () => {
        console.log("Resolving", { fullPath, fullFile });
        return new Response(
          fs.createReadStream(fullFile, { encoding: "utf-8" }),
          {
            status: 200,
            headers: {
              "Content-Type": `${lookup(file)}; charset=utf-8`
            }
          }
        );
      }
    ];
  }

  const mapped = [
    routeResolvedFile('/common/js/', 'mashlib/dist/mashlib.js'),
    routeResolvedFile('/common/js/', 'mashlib/dist/mashlib.min.js'),
    routeResolvedFile('/common/js/', 'mashlib/dist/mashlib.min.js.map'),
    routeResolvedFile('/common/js/', 'solid-auth-client/dist-lib/solid-auth-client.bundle.js'),
    routeResolvedFile('/common/js/', 'solid-auth-client/dist-lib/solid-auth-client.bundle.js.map'),

    // Serve bootstrap from it's node_module directory
    routeResolvedFile('/common/css/', 'bootstrap/dist/css/bootstrap.min.css'),
    routeResolvedFile('/common/css/', 'bootstrap/dist/css/bootstrap.min.css.map'),
    routeResolvedFile('/common/fonts/', 'bootstrap/dist/fonts/glyphicons-halflings-regular.eot'),
    routeResolvedFile('/common/fonts/', 'bootstrap/dist/fonts/glyphicons-halflings-regular.svg'),
    routeResolvedFile('/common/fonts/', 'bootstrap/dist/fonts/glyphicons-halflings-regular.ttf'),
    routeResolvedFile('/common/fonts/', 'bootstrap/dist/fonts/glyphicons-halflings-regular.woff'),
    routeResolvedFile('/common/fonts/', 'bootstrap/dist/fonts/glyphicons-halflings-regular.woff2'),

    // Serve OWASP password checker from it's node_module directory
    routeResolvedFile('/common/js/', 'owasp-password-strength-test/owasp-password-strength-test.js'),
    // Serve the TextEncoder polyfill
    routeResolvedFile('/common/js/', 'text-encoder-lite/text-encoder-lite.min.js'),
  ];
  const found = mapped.find(([match]) => match === url.pathname);
  if (!found) {
    return undefined;
  }
  return found[1]();
}

async function handle(initialRequest, initialResponse) {
  const request = fromRequest(initialRequest, origin);

  const earlyFileResponse = await handleFile(request);

  if (earlyFileResponse) {
    return sendResponse(earlyFileResponse, initialRequest, initialResponse);
  }

  // export type WebAccessControlMode = "Read" | "Write" | "Append" | "Control" | string;
  const mode = {
    HEAD: 'Read',
    GET: 'Read',
    DELETE: 'Write',
    PUT: 'Write',
    POST: 'Write',
    PATCH: 'Write',
    COPY: true,
    OPTIONS: 'Read'
  }[request.method.toUpperCase()];

  if (!mode) {
    // We can't handle this method using WAC
    return sendResponse(
      new Response(null, {
        status: 405
      }),
      initialRequest,
      initialResponse
    );
  }

  const options = {
    agent: 'https://localhost:8443/profile/card#me',
    origin,
    fetch,
    trustedOrigins: [origin],
    allowedCache: {},
    aclResourceCache: {},
    fetchCache: {},
    getAccessResourceAndModeIfACLResource: resource => /\.acl$/i.test(resource) ? ({
      resource: resource.replace(/\.acl$/i, ''),
      mode: 'Control'
    }) : null
  };

  const allowValue = await getAllowedHeaderValue(request.url, options);

  console.log({ allowValue });

  // Skip if true, as COPY will also hit the "GET" & "PUT"
  const earlyResponse = await getResponse(
    request.url,
    mode,
    options
  );

  console.log({ earlyResponse });

  if (earlyResponse) {
    earlyResponse.headers.set("WAC-Allow", allowValue);
    return sendResponse(earlyResponse, initialRequest, initialResponse);
  }

  const fileUrl = new URL(request.url);

  if (request.method.toUpperCase() === "GET" && fileUrl.pathname.endsWith("/")) {
    fileUrl.pathname += "index.html";
    const earlyFileResponse = await baseStore.fetch(
      new Request(
        fileUrl.toString(),
        {
          method: request.method,
          headers: request.headers
        }
      )
    );
    if (earlyFileResponse.ok) {
      return sendResponse(earlyFileResponse, initialRequest, initialResponse);
    }
  } else if (!fileUrl.pathname.substr(fileUrl.pathname.lastIndexOf("/")).includes(".")) {
    fileUrl.pathname += ".ttl";
    const earlyFileResponse = await baseStore.fetch(
      new Request(
        fileUrl.toString(),
        {
          method: request.method,
          headers: request.headers
        }
      )
    );
    if (earlyFileResponse.ok) {
      return sendResponse(earlyFileResponse, initialRequest, initialResponse);
    }
  }

  // Anything past here is authenticated for said access
  const fetchedResponse = await rdfStore.fetch(
    request
  );

  fetchedResponse.headers.set("WAC-Allow", allowValue);

  if (!fetchedResponse.partial) {
    return sendResponse(fetchedResponse, initialRequest, initialResponse)
  }

  return sendResponse(
    await new ResponseBuilder({
      useSetForEntityHeaders: true
    })
      .with(fetchedResponse)
      // Complete request with fsStore
      .with(await fetch(request))
      .build(),
    initialRequest,
    initialResponse
  );
}

const server = http.createServer((request, response) => {
  return handle(request, response)
    .catch(error => {
      console.error(error);
      try {
        response.writeHead(500, {
          "Content-Type": "text/plain"
        });
        response.end(error.message);
      } catch(e) {
        // Unsure what to do here, this would have only been if
        // the head was already written
      }
    });
});


server.listen(port, () => console.log(`Listening on port ${port}`));
