import { Request, Response } from "@opennetwork/http-representation";
import fs from "fs";
import { lookup } from "mime-types";

export default async function handleFile(request) {
  const url = new URL(request.url);

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
        return new Response(
          fs.createReadStream(
            fullFile,
            {
              encoding: "utf-8"
            }
          ),
          {
            status: 200,
            headers: {
              "Content-Type": lookup(file)
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
