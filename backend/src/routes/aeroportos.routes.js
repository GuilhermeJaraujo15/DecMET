/**
 * Airport Routes
 * Defines endpoints for airport search and suggestions
 */

import express from "express";
import { searchAirports, getAirportSuggestions, getAirportById } from "../controllers/aeroportos.controller.js";

const router = express.Router();

// Autocomplete suggestions
router.get("/sugestoes", getAirportSuggestions);

// Search alias kept before /:id so /search is not treated as an airport ID.
router.get("/search", searchAirports);

// Exact airport lookup by database ID
router.get("/:id", getAirportById);

// Full airport search
router.get("/", searchAirports);

export default router;
