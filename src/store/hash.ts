import globalOrSelf from "./global-or-self";

function readStringAsArrayBuffer(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length * 2);
  const view = new Uint16Array(buffer);
  for (let index = 0; index < value.length; index += 1) {
    view[index] = value.charCodeAt(index);
  }
  return buffer;
}

async function getModule(module: string) {
  // If require is available, we aren't using esm
  if (typeof require === "function") {
    return require(module);
  }
  // Eval the import syntax, as if in esm but no dynamic import, we may run into a syntax error
  const fn = new Function("module", "return import(module);");
  return fn(module);
}

async function hashViaCryptoModule(value: string): Promise<string> {
  const crypto = await getModule("crypto")
    .catch(() => undefined);
  if (!crypto) {
    throw new Error("Unable to hash patch");
  }
  return crypto.createHash("md5").update(value).digest("hex", undefined);
}

export default async function hash(value: string): Promise<string> {
  if (!(globalOrSelf as Window).crypto) {
    return hashViaCryptoModule(value);
  }
  // https://stackoverflow.com/a/53490958/1174869
  const buffer = readStringAsArrayBuffer(value);
  const hashBuffer = await (globalOrSelf as Window).crypto.subtle.digest("md5", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map(value => ("00" + value.toString(16)).slice(-2))
    .join("");
}
