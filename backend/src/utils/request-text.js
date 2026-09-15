// Absolute deadline includes DNS, connection, headers and the whole response.
// No retries or redirects. Provider wrappers keep their public error contracts.
export function requestText(client, url, { headers, timeoutMs, deadline, timeoutError, networkError }) {
  const expiresAt = Math.min(Date.now() + timeoutMs, deadline ?? Infinity);
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return Promise.reject(timeoutError());

  return new Promise((resolve, reject) => {
    let request;
    let responseStream;
    let settled = false;
    let timer;

    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Settle explicitly; do not depend on a later socket error to reject.
      reject(error);
      responseStream?.destroy();
      request?.destroy();
    }

    timer = setTimeout(() => fail(timeoutError()), remainingMs);
    timer.unref?.();

    try {
      request = client.request(url, {
        method: "GET",
        headers,
        timeout: remainingMs
      }, response => {
        responseStream = response;
        response.on("error", () => fail(networkError()));
        response.on("aborted", () => fail(networkError()));
        response.on("close", () => {
          if (!response.complete) fail(networkError());
        });
        if (settled) {
          response.destroy();
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => { body += chunk; });
        response.on("end", () => {
          if (settled) return;
          if (Date.now() >= expiresAt) {
            fail(timeoutError());
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve({ statusCode: response.statusCode, body });
        });
      });
      request.on("timeout", () => fail(timeoutError()));
      request.on("error", () => fail(networkError()));
      request.end();
    } catch {
      fail(networkError());
    }
  });
}
