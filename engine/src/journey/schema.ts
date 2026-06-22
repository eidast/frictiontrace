import { z } from "zod";

export const WaitFor = z.enum(["domcontentloaded", "networkidle", "load", "selector"]);
export type WaitFor = z.infer<typeof WaitFor>;

export const UserAgent = z.enum(["desktop", "mobile"]);
export type UserAgent = z.infer<typeof UserAgent>;

export const Throttle = z.enum(["none", "slow-3g", "slow-4g"]);
export type Throttle = z.infer<typeof Throttle>;

export const Settings = z.object({
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  userAgent: UserAgent.default("desktop"),
  locale: z.string().default("en-US"),
  timezone: z.string().default("UTC"),
  throttle: Throttle.default("none"),
  cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string().optional() })).default([]),
});

export const Artifacts = z.object({
  har: z.boolean().default(true),
  mhtml: z.boolean().default(true),
  trace: z.boolean().default(true),
  video: z.boolean().default(true),
  screenshots: z
    .object({
      viewport: z.boolean().default(true),
      fullPage: z.boolean().default(true),
    })
    .default({ viewport: true, fullPage: true }),
});

export const Target = z.object({
  baseUrl: z.string().min(1),
  country: z.string().optional(),
  currency: z.string().optional(),
});

export const ActionOnError = z.enum(["fail_step", "skip_step", "continue"]);
export type ActionOnError = z.infer<typeof ActionOnError>;

export const Action = z.object({
  findSelector: z.string().optional(),
  fallback: z.array(z.string()).optional(),
  onError: ActionOnError.default("skip_step"),
  optional: z.boolean().default(false),
  action: z.enum(["click", "type", "scroll", "press_enter"]).optional(),
  type: z.string().optional(),
  pressEnter: z.boolean().optional(),
  scroll: z.object({ to: z.enum(["bottom", "top", "selector"]), selector: z.string().optional(), smooth: z.boolean().default(true) }).optional(),
  afterMs: z.number().int().nonnegative().optional(),
});

export const Step = z.object({
  name: z.string().min(1),
  kind: z.enum(["navigate", "interact", "extract_and_click"]),
  url: z.string().optional(),
  waitFor: WaitFor.default("domcontentloaded"),
  timeoutMs: z.number().int().positive().default(10000),
  selector: z.string().optional(),
  fallback: z.array(z.string()).optional(),
  actions: z.array(Action).optional(),
  assertions: z.array(z.string()).optional(),
});

export const JourneyConfig = z.object({
  name: z.string().min(1),
  version: z.number().int().positive().default(1),
  target: Target,
  settings: Settings,
  artifacts: Artifacts.default({
    har: true,
    mhtml: true,
    trace: true,
    video: true,
    screenshots: { viewport: true, fullPage: true },
  }),
  steps: z.array(Step).min(1),
});

export type JourneyConfigT = z.infer<typeof JourneyConfig>;
export type StepT = z.infer<typeof Step>;
export type ActionT = z.infer<typeof Action>;
