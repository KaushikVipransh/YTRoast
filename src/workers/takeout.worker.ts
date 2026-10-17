// Runs the Takeout pipeline off the main thread so phones stay responsive on 100k+ entry exports (PRD F4, US-10).
import { expose } from "comlink";
import { processTakeout } from "@/lib/takeout/process";

expose({ processTakeout });
