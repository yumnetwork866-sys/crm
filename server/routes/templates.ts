import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/authMiddleware";
import { authenticateToken, requirePermission } from "../middleware/authMiddleware";
import { Permission } from "../auth/permissions";
import { prisma } from "../lib/prisma";
import {
  createMessageTemplate,
  createSurveyFlow,
  deleteMessageTemplate,
  fetchMessageTemplates,
  fetchTemplateAnalytics,
  fetchWhatsAppFlows,
  getIntegrationSetting,
  uploadTemplateSampleMedia,
} from "../services/metaApiClient";

const router = Router();
router.use(authenticateToken);

export const categorySchema = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);

export const templateBulkActionSchema = z.object({
  templates: z.array(z.object({
    id: z.string().trim().regex(/^\d+$/, "Template ID phải là số.").max(128),
    name: z.string().trim().regex(/^[a-z0-9_]+$/, "Tên template không hợp lệ.").max(512),
    language: z.string().trim().min(2).max(32),
  }).strict()).min(1).max(100),
}).strict();

export const templateAnalyticsQuerySchema = z.object({
  start: z.coerce.number().int().nonnegative().optional(),
  end: z.coerce.number().int().nonnegative().optional(),
  templateIds: z.preprocess(
    (value) => {
      const values = Array.isArray(value) ? value : [value];
      return values.flatMap((item) => typeof item === "string" ? item.split(",") : []);
    },
    z.array(z.string().trim().regex(/^\d+$/, "Template ID phải là số.").max(128)).min(1).max(100),
  ).transform((templateIds) => Array.from(new Set(templateIds))),
}).strict().superRefine((data, context) => {
  if ((data.start === undefined) !== (data.end === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [data.start === undefined ? "start" : "end"],
      message: "start và end phải được cung cấp cùng nhau.",
    });
  } else if (data.start !== undefined && data.end !== undefined && data.start >= data.end) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end"],
      message: "end phải lớn hơn start.",
    });
  }
});

const namedParameterRegex = /^[a-z][a-z0-9_]*$/;
const variableRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;
const exampleSchema = z.object({
  name: z.string().trim().regex(namedParameterRegex, "Tên biến phải là định danh chữ thường.").optional(),
  value: z.string().trim().min(1).max(1024),
}).strict();

const headerSchema = z.object({
  format: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]),
  text: z.string().trim().max(60).optional(),
  examples: z.array(exampleSchema).max(1).default([]),
  mediaHandle: z.string().trim().min(1).max(2048).optional(),
}).strict();

const templateButtonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "VOICE_CALL", "FLOW", "COPY_CODE", "CONTACT"]),
  text: z.string().trim().min(1).max(40),
  url: z.string().trim().max(2000).optional(),
  urlExample: z.string().trim().max(2000).optional(),
  flowId: z.string().trim().max(255).optional(),
  navigateScreen: z.string().trim().max(255).optional(),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Số điện thoại phải theo chuẩn E.164.").optional(),
  activeForDays: z.number().int().min(1).max(30).optional(),
}).strict();

const authenticationButtonSchema = z.object({
  text: z.string().trim().min(1).max(40).optional(),
  autofill: z.string().trim().min(1).max(40).optional(),
  package: z.string().trim().min(1).max(255).optional(),
  signature: z.string().trim().min(1).max(255).optional(),
  zeroTapTermsAccepted: z.boolean().optional(),
}).strict();

const authenticationSchema = z.object({
  addSecurityRecommendation: z.boolean().optional(),
  codeExpirationMinutes: z.number().int().min(1).max(90).optional(),
  otpType: z.enum(["COPY_CODE", "ONE_TAP", "ZERO_TAP"]),
  button: authenticationButtonSchema.default({}),
}).strict();

function getTemplateVariables(text: string): string[] {
  return Array.from(text.matchAll(variableRegex), (match) => match[1].trim());
}

function validateExamplesForText(options: {
  text: string;
  examples: Array<{ name?: string; value: string }>;
  parameterFormat: "POSITIONAL" | "NAMED";
  textPath: (string | number)[];
  examplesPath: (string | number)[];
  context: z.RefinementCtx;
  maxVariables?: number;
}) {
  const { text, examples, parameterFormat, textPath, examplesPath, context, maxVariables } = options;
  const variables = getTemplateVariables(text);
  const uniqueVariables = Array.from(new Set(variables));

  if (maxVariables !== undefined && uniqueVariables.length > maxVariables) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: textPath,
      message: `Chỉ được dùng tối đa ${maxVariables} biến.`,
    });
  }

  if (parameterFormat === "POSITIONAL") {
    const positions = uniqueVariables.map(Number).sort((a, b) => a - b);
    const valid = positions.every((position, index) => Number.isInteger(position) && position === index + 1);
    if (!valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: textPath,
        message: "Biến positional phải liên tục từ {{1}}, {{2}}, ...",
      });
    }
    if (examples.length !== uniqueVariables.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: examplesPath,
        message: `Nội dung có ${uniqueVariables.length} biến nhưng nhận được ${examples.length} ví dụ.`,
      });
    }
    return;
  }

  if (uniqueVariables.some((name) => !namedParameterRegex.test(name))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: textPath,
      message: "Biến named phải là định danh chữ thường, ví dụ {{customer_name}}.",
    });
  }
  const exampleNames = examples.map((example) => example.name).filter((name): name is string => Boolean(name));
  const hasMatchingExamples = examples.length === uniqueVariables.length
    && exampleNames.length === examples.length
    && new Set(exampleNames).size === exampleNames.length
    && uniqueVariables.every((name) => exampleNames.includes(name));
  if (!hasMatchingExamples) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: examplesPath,
      message: "Mỗi biến named phải có đúng một ví dụ với name khớp tên biến.",
    });
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const templateCreateSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]+$/, "Tên template chỉ gồm chữ thường, số và dấu gạch dưới.").max(512),
  language: z.string().trim().min(2).max(12),
  category: categorySchema,
  parameterFormat: z.enum(["POSITIONAL", "NAMED"]).optional(),
  allowCategoryChange: z.boolean().optional(),
  header: headerSchema.optional(),
  body: z.string().trim().max(1024).optional(),
  bodyExamples: z.array(exampleSchema).max(20).default([]),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(10).default([]),
  authentication: authenticationSchema.optional(),
}).strict().superRefine((data, context) => {
  if (data.category === "AUTHENTICATION") {
    if (!data.authentication) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["authentication"], message: "Thiếu cấu hình authentication." });
      return;
    }
    if (data.parameterFormat || data.header || data.body || data.bodyExamples.length || data.footer || data.buttons.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Template AUTHENTICATION chỉ nhận cấu hình authentication.",
      });
    }
    const { otpType, button } = data.authentication;
    if (otpType === "COPY_CODE") {
      if (button.autofill || button.package || button.signature || button.zeroTapTermsAccepted !== undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["authentication", "button"], message: "COPY_CODE không nhận cấu hình ứng dụng." });
      }
    } else {
      if (!button.autofill || !button.package || !button.signature) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["authentication", "button"],
          message: `${otpType} yêu cầu autofill, package và signature.`,
        });
      }
      if (otpType === "ONE_TAP" && button.zeroTapTermsAccepted !== undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["authentication", "button", "zeroTapTermsAccepted"], message: "ONE_TAP không nhận zeroTapTermsAccepted." });
      }
      if (otpType === "ZERO_TAP" && button.zeroTapTermsAccepted !== true) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["authentication", "button", "zeroTapTermsAccepted"], message: "ZERO_TAP yêu cầu chấp nhận điều khoản zero tap." });
      }
    }
    return;
  }

  if (data.authentication) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["authentication"], message: "authentication chỉ dùng cho category AUTHENTICATION." });
  }
  if (!data.body) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "BODY là bắt buộc." });
  }
  const parameterFormat = data.parameterFormat || "POSITIONAL";
  if (data.body) {
    validateExamplesForText({
      text: data.body,
      examples: data.bodyExamples,
      parameterFormat,
      textPath: ["body"],
      examplesPath: ["bodyExamples"],
      context,
    });
  }
  if (data.footer && getTemplateVariables(data.footer).length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["footer"], message: "FOOTER không được chứa biến." });
  }

  if (data.header) {
    const { format, text, examples, mediaHandle } = data.header;
    if (format === "TEXT") {
      if (!text) context.addIssue({ code: z.ZodIssueCode.custom, path: ["header", "text"], message: "HEADER TEXT yêu cầu text." });
      if (mediaHandle) context.addIssue({ code: z.ZodIssueCode.custom, path: ["header", "mediaHandle"], message: "HEADER TEXT không nhận mediaHandle." });
      if (text) {
        validateExamplesForText({
          text,
          examples,
          parameterFormat,
          textPath: ["header", "text"],
          examplesPath: ["header", "examples"],
          context,
          maxVariables: 1,
        });
      }
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
      if (!mediaHandle) context.addIssue({ code: z.ZodIssueCode.custom, path: ["header", "mediaHandle"], message: `HEADER ${format} yêu cầu mediaHandle.` });
      if (text || examples.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["header"], message: `HEADER ${format} không nhận text hoặc examples.` });
    } else if (text || examples.length || mediaHandle) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["header"], message: "HEADER NONE không nhận nội dung." });
    }
  }

  const normalizedButtonTexts = data.buttons.map((button) => button.text.trim().replace(/\s+/g, " ").toLocaleLowerCase());
  const duplicateButtonText = normalizedButtonTexts.find(
    (text, index) => text && normalizedButtonTexts.indexOf(text) !== index,
  );
  if (duplicateButtonText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["buttons"],
      message: "Không thể dùng cùng nội dung cho nhiều button.",
    });
  }

  const urlButtons = data.buttons.filter((button) => button.type === "URL");
  const phoneButtons = data.buttons.filter((button) => button.type === "PHONE_NUMBER");
  if (urlButtons.length > 2) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons"], message: "Chỉ được có tối đa 2 button URL." });
  if (phoneButtons.length > 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons"], message: "Chỉ được có tối đa 1 button PHONE_NUMBER." });

  data.buttons.forEach((button, index) => {
    if (button.type === "URL") {
      if (!button.url || !isHttpsUrl(button.url)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "url"], message: "Button URL yêu cầu URL https hợp lệ." });
      }
      const variables = button.url ? getTemplateVariables(button.url) : [];
      const uniqueVariables = Array.from(new Set(variables));
      if (uniqueVariables.length > 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "url"], message: "Button URL chỉ được chứa tối đa 1 biến." });
      }
      if (parameterFormat === "POSITIONAL" && uniqueVariables.some((name) => name !== "1")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "url"], message: "Biến URL positional phải là {{1}}." });
      }
      if (parameterFormat === "NAMED" && uniqueVariables.some((name) => !namedParameterRegex.test(name))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "url"], message: "Biến URL named phải là định danh chữ thường." });
      }
      if (uniqueVariables.length === 1 && (!button.urlExample || !isHttpsUrl(button.urlExample))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "urlExample"], message: "URL động yêu cầu urlExample https hợp lệ." });
      }
      if (uniqueVariables.length === 0 && button.urlExample) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "urlExample"], message: "URL tĩnh không nhận urlExample." });
      }
      if (button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "phoneNumber"], message: "Button URL không nhận phoneNumber." });
      if (button.activeForDays !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "activeForDays"], message: "Button URL không nhận activeForDays." });
    } else if (button.type === "PHONE_NUMBER") {
      if (!button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "phoneNumber"], message: "Button PHONE_NUMBER yêu cầu phoneNumber." });
      if (button.url || button.urlExample || button.activeForDays !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index], message: "Button PHONE_NUMBER không nhận URL hoặc activeForDays." });
    } else if (button.type === "VOICE_CALL") {
      if (button.activeForDays === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "activeForDays"], message: "Button VOICE_CALL yêu cầu hiệu lực từ 1 đến 30 ngày." });
      if (button.url || button.urlExample || button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index], message: "Button VOICE_CALL chỉ nhận type, text và activeForDays." });
    } else if (button.type === "FLOW") {
      if (!button.flowId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index, "flowId"], message: "Button FLOW yêu cầu Flow ID." });
      if (button.url || button.urlExample || button.phoneNumber || button.activeForDays !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index], message: "Button FLOW chỉ nhận Flow ID và tên màn hình." });
    } else if (button.url || button.urlExample || button.phoneNumber || button.activeForDays !== undefined || button.flowId || button.navigateScreen) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", index], message: "Button này chỉ nhận type và text." });
    }
  });
});

const surveyFlowScreenSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề màn hình là bắt buộc.").max(30),
  heading: z.string().trim().min(1, "Tiêu đề câu hỏi là bắt buộc.").max(80),
  description: z.string().trim().min(1, "Mô tả câu hỏi là bắt buộc.").max(300),
  options: z.array(z.string().trim().min(1).max(30)).min(2).max(20),
}).strict().superRefine((screen, context) => {
  const normalizedOptions = screen.options.map((option) => option.toLocaleLowerCase());
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Các phương án trong cùng một câu hỏi không được trùng nhau.",
    });
  }
});

export const surveyFlowCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên Flow là bắt buộc.").max(200),
  screens: z.tuple([surveyFlowScreenSchema, surveyFlowScreenSchema, surveyFlowScreenSchema]),
}).strict();

export const templateMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "video/mp4", "application/pdf"]),
  dataBase64: z.string().min(1).max(25_000_000).regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    "dataBase64 không hợp lệ.",
  ),
}).strict().superRefine((data, context) => {
  const byteLength = Buffer.byteLength(data.dataBase64, "base64");
  if (data.mimeType.startsWith("image/") && byteLength > 5 * 1024 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataBase64"], message: "Ảnh mẫu (JPEG/PNG) không được vượt quá 5 MB theo chuẩn Meta." });
  } else if (byteLength > 16 * 1024 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dataBase64"], message: "File mẫu không được vượt quá 16 MB." });
  }
});

async function getWabaContext() {
  const setting = await getIntegrationSetting();
  const wabaId = setting.whatsappWabaId?.trim() || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "";
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
  const appId = setting.whatsappAppId?.trim() || process.env.WHATSAPP_APP_ID?.trim() || "";
  return { wabaId, token, appId };
}

// GET /analytics - Real daily analytics loaded directly from WABA
router.get("/analytics", requirePermission(Permission.AUTOMATION_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = templateAnalyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Tham số thống kê template không hợp lệ.",
    });
  }
  try {
    const { wabaId, token } = await getWabaContext();
    if (!wabaId || !token) {
      return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
    }
    const end = parsed.data.end ?? Math.floor(Date.now() / 1000);
    const start = parsed.data.start ?? end - (30 * 24 * 60 * 60);
    const data = await fetchTemplateAnalytics({
      wabaId,
      token,
      templateIds: parsed.data.templateIds,
      start,
      end,
    });
    return res.json({ start, end, data });
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || "Không thể tải thống kê template từ Meta.",
    });
  }
});

// GET / - Read templates directly from Meta
router.get("/", requirePermission(Permission.AUTOMATION_VIEW), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { wabaId, token } = await getWabaContext();
    if (!wabaId || !token) {
      return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
    }
    const templates = await fetchMessageTemplates({ wabaId, token });
    const templateIds = templates.flatMap((template) => template.id ? [template.id] : []);
    const archived = templateIds.length
      ? await prisma.whatsAppTemplateArchive.findMany({
          where: { wabaId, templateId: { in: templateIds } },
          select: { templateId: true },
        })
      : [];
    const archivedIds = new Set(archived.map((item) => item.templateId));
    return res.json(
      templates.map((template) => ({
        ...template,
        is_archived: template.id ? archivedIds.has(template.id) : false,
      })),
    );
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || "Không thể đồng bộ danh sách template từ Meta.",
    });
  }
});

// GET /flows - Fetch WhatsApp Flows
router.get("/flows", requirePermission(Permission.AUTOMATION_VIEW), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { wabaId, token } = await getWabaContext();
    if (!wabaId || !token) {
      return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
    }
    const flows = await fetchWhatsAppFlows({ wabaId, token });
    return res.json(flows);
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || "Không thể tải danh sách WhatsApp Flows từ Meta.",
    });
  }
});

// POST /flows - Create Survey Flow
router.post(
  "/flows",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = surveyFlowCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Dữ liệu khảo sát không hợp lệ.",
      });
    }
    try {
      const { wabaId, token } = await getWabaContext();
      if (!wabaId || !token) {
        return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
      }
      const createdFlow = await createSurveyFlow({
        wabaId,
        token,
        name: parsed.data.name,
        screens: parsed.data.screens,
      });
      return res.status(201).json(createdFlow);
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || "Không thể tạo WhatsApp Survey Flow trên Meta.",
      });
    }
  },
);

// POST /media - Upload sample media for template approval
router.post(
  "/media",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateMediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Dữ liệu file mẫu không hợp lệ.",
      });
    }
    try {
      const { token, appId } = await getWabaContext();
      if (!token || !appId) {
        return res.status(409).json({ error: "Chưa cấu hình access token hoặc App ID." });
      }
      const handle = await uploadTemplateSampleMedia({
        appId,
        token,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        buffer: Buffer.from(parsed.data.dataBase64, "base64"),
      });
      return res.status(201).json({ handle });
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || "Không thể tải file mẫu lên Meta.",
      });
    }
  },
);

// POST / - Create template
router.post(
  "/",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Dữ liệu template không hợp lệ.",
      });
    }
    try {
      const { wabaId, token } = await getWabaContext();
      if (!wabaId || !token) {
        return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
      }
      const createdTemplate = await createMessageTemplate({
        wabaId,
        token,
        ...parsed.data,
      });
      return res.status(201).json(createdTemplate);
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || "Không thể gửi tạo template lên Meta.",
      });
    }
  },
);

// POST /bulk-archive
router.post(
  "/bulk-archive",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateBulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." });
    }
    const { wabaId } = await getWabaContext();
    if (!wabaId) {
      return res.status(400).json({ error: "Chưa cấu hình WABA ID trong hệ thống." });
    }

    await prisma.whatsAppTemplateArchive.createMany({
      data: parsed.data.templates.map((template) => ({
        wabaId,
        templateId: template.id,
        templateName: template.name,
        language: template.language,
        archivedById: req.user?.id || null,
      })),
      skipDuplicates: true,
    });

    return res.json({ success: true, count: parsed.data.templates.length });
  },
);

// POST /bulk-unarchive
router.post(
  "/bulk-unarchive",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateBulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." });
    }
    const { wabaId } = await getWabaContext();
    if (!wabaId) {
      return res.status(400).json({ error: "Chưa cấu hình WABA ID trong hệ thống." });
    }

    const templateIds = parsed.data.templates.map((template) => template.id);
    await prisma.whatsAppTemplateArchive.deleteMany({
      where: { wabaId, templateId: { in: templateIds } },
    });

    return res.json({ success: true, count: templateIds.length });
  },
);

// POST /bulk-delete
router.post(
  "/bulk-delete",
  requirePermission(Permission.AUTOMATION_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateBulkActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." });
    }
    const { wabaId, token } = await getWabaContext();
    if (!wabaId || !token) {
      return res.status(409).json({ error: "Chưa cấu hình WhatsApp Business Account ID hoặc access token." });
    }

    const results = await Promise.allSettled(
      parsed.data.templates.map((template) =>
        deleteMessageTemplate({
          wabaId,
          token,
          templateId: template.id,
          name: template.name,
        })
      ),
    );

    const deletedIds = parsed.data.templates
      .filter((_, index) => results[index].status === "fulfilled")
      .map((template) => template.id);

    if (deletedIds.length > 0) {
      await prisma.whatsAppTemplateArchive.deleteMany({
        where: { wabaId, templateId: { in: deletedIds } },
      }).catch(() => undefined);
    }

    const failedCount = results.filter((result) => result.status === "rejected").length;
    return res.json({
      success: true,
      deleted: deletedIds.length,
      failed: failedCount,
    });
  },
);

export default router;
