import { graph, parse } from "rdflib";

export async function isValidRDF(value: string, uri: string, contentType: string): Promise<boolean> {
  const resourceGraph = graph();
  try {
    await new Promise(
      (resolve, reject) => parse(
        value,
        resourceGraph,
        uri,
        // Ensure we used the "parsed" media type
        contentType.split(";")[0].trim(),
        (error) => error ? reject(error) : resolve()
      )
    );
  } catch (e) {
    return false;
  }
  return true;
}
