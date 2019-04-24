import { FSStore, LayerStore, getContentLocation as getContentLocationFS } from "@opennetwork/http-store";
import { fromRequest, sendResponse } from "@opennetwork/http-representation-node";
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
import handleDataBrowser from "./util/handle-data-browser";
import handleEarlyAccepted from "./util/handle-early-accepted";
import vary from "./util/vary";

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
  getContentLocation: (request) => getContentLocationFS(request, fsStoreOptions)
};

const store = new LayerStore({
  layers: [
    handleXSS,
    vary,
    handleACL, // ACL should be before anything internal
    getACLResponseBase,
    handleDataBrowser(fsStoreOptions),
    handleEarlyAccepted,
    handleFile,
    new RDFStore(rdfStoreOptions),
    getContentTypeResponse,
    new FSStore(fsStoreOptions)
  ]
});

async function handle(initialRequest, initialResponse) {
  const request = fromRequest(initialRequest, origin);

  const builder = await store.builder(request);
  const response = await builder.build();
  console.log(response, builder.responses);

  return sendResponse(
    response,
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
