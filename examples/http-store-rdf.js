import { FSStore, LayerStore, getContentLocation as getContentLocationFS, getPath } from "@opennetwork/http-store";
import { fromRequest, sendResponse } from "@opennetwork/http-representation-node";
import { Response } from "@opennetwork/http-representation";
import http from "http";
import fs from "fs";
import rimraf from "rimraf";
import { mkdirp } from "fs-extra";
import getACLResponseBase from "./util/http-store-with-acl";
import getContentTypeResponse from "./util/content-type";
import ACLCheck from "@solid/acl-check";
import { RDFStore } from "../dist";
import getContentType from "./util/get-content-type";
import getContentLocation from "./util/get-content-location";
import handleXSS from "./util/handle-xss";
import handleFile from "./util/handle-file";
import handleACL from "./util/handle-acl";
import { origin, port } from "./origin";

ACLCheck.configureLogger(() => {});

/**
 * @type {FSStoreOptions}
 */
const fsStoreOptions = {
  fs,
  rootPath: './examples/store',
  statusCodes: http.STATUS_CODES,
  rimraf,
  mkdirp,
  getContentType,
  getContentLocation
};

/**
 * @type {RDFStoreOptions}
 */
const rdfStoreOptions = {
  authMethod: "oidc",
  serverUri: origin,
  metaSuffix: ".meta",
  aclSuffix: ".acl",
  getDataBrowser: async (request) => {
    const dataBrowserPath = "/static/databrowser.html";
    const dataBrowserUrl = new URL(dataBrowserPath, origin).toString();
    const path = await getPath(dataBrowserUrl, fsStoreOptions);
    const headers = {
      "Content-Type": "text/html; charset=utf-8"
    };
    if (new URL(request.url).pathname !== dataBrowserPath) {
      headers["Content-Location"] = dataBrowserUrl;
    }
    return new Response(
      fs.createReadStream(
        path,
        {
          encoding: "utf-8"
        }
      ),
      {
        status: 200,
        headers
      }
    );
  },
  getContentLocation: (request) => getContentLocationFS(request, fsStoreOptions)
};

const store = new LayerStore({
  layers: [
    handleXSS,
    handleACL, // ACL should be before anything internal
    handleFile,
    new RDFStore(rdfStoreOptions),
    getContentTypeResponse,
    getACLResponseBase,
    new FSStore(fsStoreOptions)
  ]
});

async function handle(initialRequest, initialResponse) {
  const request = fromRequest(initialRequest, origin);

  return sendResponse(
    await store.fetch(request),
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
