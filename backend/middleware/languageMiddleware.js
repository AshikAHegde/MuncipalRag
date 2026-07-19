import { normalizeLanguage } from "../config/languages.js";

export function resolvePreferredLanguage(req, _res, next) {
  req.preferredLanguage = normalizeLanguage(
    req.query?.language || req.body?.language || req.headers["x-language"],
  );

  return next();
}
