import express from "express";

const STATIC_REDIRECTS = [
  { source: "/index.html", destination: "/" },
  { source: "/pages/index.html", destination: "/" },
  { source: "/pages/apiMet.html", destination: "/metar.html" },
  { source: "/pages/metar.html", destination: "/metar.html" },
  { source: "/pages/decodificador.html", destination: "/decoder.html" },
  { source: "/pages/decoder.html", destination: "/decoder.html" },
  { source: "/pages/sobre-metar.html", destination: "/about-metar.html" },
  { source: "/pages/about-metar.html", destination: "/about-metar.html" },
  { source: "/pages/aerodromo.html", destination: "/airports.html" },
  { source: "/pages/airports.html", destination: "/airports.html" }
];

export function registerLocalStaticFrontend(app, publicDir) {
  app.get("/metar.html", (req, res, next) => {
    if (hasIcaoQueryParameter(req)) {
      return res.redirect(301, "/metar.html");
    }

    return next();
  });

  for (const { source, destination } of STATIC_REDIRECTS) {
    app.get(source, redirectPermanent(destination));
  }

  app.get(["/estacao/:icao", "/:lang/estacao/:icao"], redirectPermanent("/metar.html"));
  app.use(express.static(publicDir));

  return app;
}

function redirectPermanent(destination) {
  return function redirectToCanonical(req, res) {
    res.redirect(301, destination);
  };
}

function hasIcaoQueryParameter(req) {
  return Object.keys(req.query || {}).some(key => key.toLowerCase() === "icao");
}

