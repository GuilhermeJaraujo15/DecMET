import express from "express";
import { getLatestMetar } from "../controllers/metar.controller.js";

const router = express.Router();

router.get("/:icao", getLatestMetar);

export default router;
