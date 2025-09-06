import { Router } from "express";
import * as controller from "../controllers/certificate.controller";

const router = Router();

router.post("/issue", controller.issue);
router.get("/:id/verify", controller.verify);
router.get("/:id", controller.view);
router.post("/:id/revoke", controller.revoke);

export default router;
