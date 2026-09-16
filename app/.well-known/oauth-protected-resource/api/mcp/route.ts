import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { baseUrl, RESOURCE_PATH } from "@/lib/auth/env";

export const runtime = "nodejs";

export const GET = protectedResourceHandler({ authServerUrls: [baseUrl()], resourceUrl: `${baseUrl()}${RESOURCE_PATH}` });
export const OPTIONS = metadataCorsOptionsRequestHandler();
